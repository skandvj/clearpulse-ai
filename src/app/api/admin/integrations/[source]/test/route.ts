import { NextResponse } from "next/server";
import type { SignalSource } from "@prisma/client";
import {
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import {
  getConfiguredEnv,
  INTEGRATION_DEFINITIONS,
  type IntegrationStatus,
} from "@/lib/integrations/catalog";
import { prisma } from "@/lib/db";
import {
  applyRateLimitHeaders,
  buildRateLimitKey,
  checkRateLimit,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

function resolveStatus(args: {
  configuredCount: number;
  requiredCount: number;
  latestJobStatus: string | null;
}): IntegrationStatus {
  if (args.configuredCount === 0) return "DISCONNECTED";
  if (args.configuredCount < args.requiredCount) return "PARTIAL";
  if (args.latestJobStatus === "FAILED") return "ERROR";
  return "CONNECTED";
}

export async function POST(
  request: Request,
  { params }: { params: { source: string } }
) {
  try {
    const user = await requirePermission(PERMISSIONS.CONFIGURE_INTEGRATIONS);

    const source = params.source as SignalSource;
    const definition = INTEGRATION_DEFINITIONS[source];

    if (!definition) {
      return errorResponse("Unknown integration source", 404);
    }

    const rateLimit = await checkRateLimit({
      key: buildRateLimitKey({
        request,
        scope: "admin-integration-test",
        userId: user.id,
        resource: source,
      }),
      limit: 30,
      windowSeconds: 10 * 60,
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        "Too many integration test requests for this source. Please wait a few minutes before retrying."
      );
    }

    const [latestJob, signalCount] = await Promise.all([
      prisma.syncJob.findFirst({
        where: { source },
        orderBy: { createdAt: "desc" },
        select: {
          status: true,
          error: true,
          completedAt: true,
          createdAt: true,
          signalsFound: true,
        },
      }),
      prisma.rawSignal.count({ where: { source } }),
    ]);

    const config = getConfiguredEnv(definition.requiredEnv);
    const status = resolveStatus({
      configuredCount: config.configuredCount,
      requiredCount: config.requiredCount,
      latestJobStatus: latestJob?.status ?? null,
    });

    const message =
      status === "CONNECTED"
        ? "Configuration looks complete and ready for sync."
        : status === "ERROR"
          ? latestJob?.error || "Configuration is present, but the most recent sync failed."
          : `Missing environment variables: ${config.missingEnv.join(", ")}`;

    const response = NextResponse.json({
      ok: status === "CONNECTED",
      source,
      status,
      checkedAt: new Date().toISOString(),
      configuredCount: config.configuredCount,
      requiredCount: config.requiredCount,
      missingEnv: config.missingEnv,
      message,
      lastJobStatus: latestJob?.status ?? null,
      lastSyncedAt: latestJob?.completedAt ?? latestJob?.createdAt ?? null,
      signalsStored: signalCount,
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
    }

    return errorResponse("Failed to test integration");
  }
}

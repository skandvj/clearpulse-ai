import { NextResponse } from "next/server";
import { z } from "zod";
import type { SignalSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import {
  INTEGRATION_DEFINITIONS,
  type IntegrationStatus,
} from "@/lib/integrations/catalog";
import {
  buildIntegrationFieldStates,
  listIntegrationSettings,
  summarizeIntegrationFields,
  upsertIntegrationSettings,
} from "@/lib/integrations/settings";

const updateSchema = z.object({
  values: z.record(z.string(), z.string()).default({}),
});

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

export async function PATCH(
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

    if (!definition.browserConfigurable) {
      return errorResponse(
        "This integration still needs environment or OAuth configuration.",
        400
      );
    }

    const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("Invalid integration payload", 400);
    }

    await upsertIntegrationSettings({
      source,
      values: parsed.data.values,
      userId: user.id,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "INTEGRATION_UPDATED",
        entityType: "Integration",
        entityId: source,
        metadata: {
          keysUpdated: Object.keys(parsed.data.values),
          source,
        },
      },
    });

    const [latestJob, signalCount, settings] = await Promise.all([
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
      listIntegrationSettings(source),
    ]);

    const fields = buildIntegrationFieldStates(definition, settings);
    const config = summarizeIntegrationFields(fields);
    const status = resolveStatus({
      configuredCount: config.configuredCount,
      requiredCount: config.requiredCount,
      latestJobStatus: latestJob?.status ?? null,
    });

    return NextResponse.json({
      message: "Integration settings saved securely.",
      integration: {
        source: definition.source,
        authType: definition.authType,
        description: definition.description,
        requiredEnv: definition.requiredEnv,
        browserConfigurable: definition.browserConfigurable,
        fields,
        missingEnv: config.missingEnv,
        configuredCount: config.configuredCount,
        requiredCount: config.requiredCount,
        status,
        lastJobStatus: latestJob?.status ?? null,
        lastSyncedAt: latestJob?.completedAt ?? latestJob?.createdAt ?? null,
        lastJobError: latestJob?.error ?? null,
        lastSignalsFound: latestJob?.signalsFound ?? null,
        signalsStored: signalCount,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
    }

    return errorResponse("Failed to save integration settings");
  }
}

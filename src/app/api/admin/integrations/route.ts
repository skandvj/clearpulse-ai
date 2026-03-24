import { NextResponse } from "next/server";
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
} from "@/lib/integrations/settings";

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

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.CONFIGURE_INTEGRATIONS);

    const [jobs, signalGroups, settings] = await Promise.all([
      prisma.syncJob.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          source: true,
          status: true,
          completedAt: true,
          createdAt: true,
          error: true,
          signalsFound: true,
        },
        take: 200,
      }),
      prisma.rawSignal.groupBy({
        by: ["source"],
        _count: { _all: true },
      }),
      listIntegrationSettings(),
    ]);

    const settingsBySource = new Map<string, typeof settings>();
    const latestJobBySource = new Map<string, (typeof jobs)[number]>();
    for (const job of jobs) {
      if (!latestJobBySource.has(job.source)) {
        latestJobBySource.set(job.source, job);
      }
    }
    for (const setting of settings) {
      const current = settingsBySource.get(setting.source) ?? [];
      current.push(setting);
      settingsBySource.set(setting.source, current);
    }

    const signalsBySource = new Map(
      signalGroups.map((group) => [group.source, group._count._all] as const)
    );

    const integrations = Object.values(INTEGRATION_DEFINITIONS).map((definition) => {
      const latestJob = latestJobBySource.get(definition.source) ?? null;
      const fieldStates = buildIntegrationFieldStates(
        definition,
        settingsBySource.get(definition.source) ?? []
      );
      const config = summarizeIntegrationFields(fieldStates);
      const status = resolveStatus({
        configuredCount: config.configuredCount,
        requiredCount: config.requiredCount,
        latestJobStatus: latestJob?.status ?? null,
      });

      return {
        source: definition.source,
        authType: definition.authType,
        description: definition.description,
        requiredEnv: definition.requiredEnv,
        browserConfigurable: definition.browserConfigurable,
        fields: fieldStates,
        missingEnv: config.missingEnv,
        configuredCount: config.configuredCount,
        requiredCount: config.requiredCount,
        status,
        lastJobStatus: latestJob?.status ?? null,
        lastSyncedAt: latestJob?.completedAt ?? latestJob?.createdAt ?? null,
        lastJobError: latestJob?.error ?? null,
        lastSignalsFound: latestJob?.signalsFound ?? null,
        signalsStored: signalsBySource.get(definition.source) ?? 0,
      };
    });

    return NextResponse.json({
      integrations,
      summary: {
        connected: integrations.filter((item) => item.status === "CONNECTED").length,
        partial: integrations.filter((item) => item.status === "PARTIAL").length,
        disconnected: integrations.filter((item) => item.status === "DISCONNECTED").length,
        error: integrations.filter((item) => item.status === "ERROR").length,
        totalSignals: integrations.reduce((sum, item) => sum + item.signalsStored, 0),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
    }

    return errorResponse("Failed to fetch integration status");
  }
}

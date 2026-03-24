import { HealthStatus } from "@prisma/client";
import { env } from "@/env";
import { prisma } from "@/lib/db";
import { getIntegrationRuntimeValue } from "@/lib/integrations/settings";

const VITALLY_BASE_URLS = ["https://api.vitally.io", "https://rest.vitally.io"];

export interface VitallyPushSummary {
  traitsPushed: number;
  noteCreated: boolean;
  timelineEventsCreated: number;
  pushedAt: string;
  warnings: string[];
}

interface VitallyPushContext {
  id: string;
  name: string;
  vitallyAccountId: string;
  healthScore: number | null;
  healthStatus: HealthStatus;
  csm: {
    name: string | null;
    email: string;
  } | null;
  kpis: Array<{
    id: string;
    metricName: string;
    targetValue: string | null;
    currentValue: string | null;
    unit: string | null;
    healthScore: number | null;
    healthStatus: HealthStatus;
    healthNarrative: string | null;
  }>;
}

function ensureVitallyConfigured() {
  if (!env.VITALLY_API_KEY) {
    throw new Error("VITALLY_API_KEY is not configured");
  }
}

async function parseResponseError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `Vitally request failed (${response.status})`;
  }

  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return parsed.error ?? parsed.message ?? text;
  } catch {
    return text;
  }
}

async function vitallyRequest(
  method: "PATCH" | "POST",
  path: string,
  body: unknown
): Promise<void> {
  const apiKey =
    (await getIntegrationRuntimeValue("VITALLY", "VITALLY_API_KEY")) ??
    env.VITALLY_API_KEY;

  if (!apiKey) {
    ensureVitallyConfigured();
  }

  let fallbackError: Error | null = null;

  for (const baseUrl of VITALLY_BASE_URLS) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (response.ok) {
      return;
    }

    const errorMessage = await parseResponseError(response);

    if ([404, 405, 501].includes(response.status)) {
      fallbackError = new Error(errorMessage);
      continue;
    }

    throw new Error(errorMessage);
  }

  throw fallbackError ?? new Error(`Vitally request failed for ${path}`);
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatHealthStatus(status: HealthStatus): string {
  return status.replace(/_/g, " ");
}

function formatMetricValue(value: string | null, unit: string | null): string {
  if (!value) return "—";
  return [value, unit].filter(Boolean).join(" ");
}

function buildTraitKey(metricName: string, existingKeys: Set<string>): string {
  const baseKey =
    metricName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "metric";

  let key = baseKey;
  let suffix = 2;

  while (existingKeys.has(key)) {
    key = `${baseKey.slice(0, Math.max(1, 48 - String(suffix).length - 1))}_${suffix}`;
    suffix += 1;
  }

  existingKeys.add(key);
  return key;
}

function buildTraitsPayload(context: VitallyPushContext) {
  const keys = new Set<string>();

  return context.kpis.reduce<Record<string, unknown>>((traits, kpi) => {
    const traitKey = buildTraitKey(kpi.metricName, keys);

    traits[traitKey] = {
      metricName: kpi.metricName,
      value: kpi.currentValue,
      targetValue: kpi.targetValue,
      unit: kpi.unit,
      healthScore: kpi.healthScore,
      healthStatus: kpi.healthStatus,
    };

    return traits;
  }, {});
}

function buildHealthNote(context: VitallyPushContext, pushedAt: Date): string {
  const header = [
    `# ClearPulse KPI Update`,
    ``,
    `Generated on ${formatDate(pushedAt)} for ${context.name}.`,
    `Account health: ${
      context.healthScore == null ? "Unknown" : `${Math.round(context.healthScore)}/100`
    } (${formatHealthStatus(context.healthStatus)}).`,
    ``,
    `## KPI Health Summary`,
  ];

  const body = context.kpis.map((kpi) => {
    const parts = [
      `- **${kpi.metricName}**`,
      `Current: ${formatMetricValue(kpi.currentValue, kpi.unit)}`,
      `Target: ${formatMetricValue(kpi.targetValue, kpi.unit)}`,
      `Health: ${
        kpi.healthScore == null ? "Unknown" : `${Math.round(kpi.healthScore)}/100`
      } (${formatHealthStatus(kpi.healthStatus)})`,
    ];

    const summary = `${parts.join(" | ")}`;
    if (!kpi.healthNarrative?.trim()) {
      return summary;
    }

    return `${summary}\n  ${kpi.healthNarrative.trim()}`;
  });

  return [...header, ...body].join("\n");
}

function buildTimelineMetadata(context: VitallyPushContext, pushedAt: Date) {
  return {
    accountName: context.name,
    pushedAt: pushedAt.toISOString(),
    accountHealthScore:
      context.healthScore == null ? null : Math.round(context.healthScore),
    accountHealthStatus: context.healthStatus,
    kpis: context.kpis.slice(0, 10).map((kpi) => ({
      metricName: kpi.metricName,
      currentValue: kpi.currentValue,
      targetValue: kpi.targetValue,
      unit: kpi.unit,
      healthScore: kpi.healthScore == null ? null : Math.round(kpi.healthScore),
      healthStatus: kpi.healthStatus,
    })),
  };
}

async function loadVitallyPushContext(
  accountId: string
): Promise<VitallyPushContext> {
  const account = await prisma.clientAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      name: true,
      vitallyAccountId: true,
      healthScore: true,
      healthStatus: true,
      csm: {
        select: {
          name: true,
          email: true,
        },
      },
      kpis: {
        orderBy: { metricName: "asc" },
        select: {
          id: true,
          metricName: true,
          targetValue: true,
          currentValue: true,
          unit: true,
          healthScore: true,
          healthStatus: true,
          healthNarrative: true,
        },
      },
    },
  });

  if (!account) {
    throw new Error("Account not found");
  }

  if (!account.vitallyAccountId) {
    throw new Error("This account is not linked to Vitally");
  }

  if (account.kpis.length === 0) {
    throw new Error("No KPIs are available to push to Vitally");
  }

  return {
    id: account.id,
    name: account.name,
    vitallyAccountId: account.vitallyAccountId,
    healthScore: account.healthScore,
    healthStatus: account.healthStatus,
    csm: account.csm,
    kpis: account.kpis,
  };
}

export async function pushAccountHealthToVitally(
  accountId: string,
  triggeredByUserId: string
): Promise<VitallyPushSummary> {
  const context = await loadVitallyPushContext(accountId);
  const pushedAt = new Date();
  const warnings: string[] = [];

  await vitallyRequest(
    "PATCH",
    `/v1/accounts/${encodeURIComponent(context.vitallyAccountId)}/traits`,
    buildTraitsPayload(context)
  );

  let noteCreated = false;
  try {
    await vitallyRequest("POST", "/v1/notes", {
      accountId: context.vitallyAccountId,
      title: `ClearPulse KPI Update — ${formatDate(pushedAt)}`,
      body: buildHealthNote(context, pushedAt),
    });
    noteCreated = true;
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Vitally note push failed: ${error.message}`
        : "Vitally note push failed"
    );
  }

  let timelineEventsCreated = 0;
  try {
    await vitallyRequest("POST", "/v1/timeline-events", {
      accountId: context.vitallyAccountId,
      type: "kpi_health_update",
      metadata: buildTimelineMetadata(context, pushedAt),
    });
    timelineEventsCreated = 1;
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Vitally timeline event push failed: ${error.message}`
        : "Vitally timeline event push failed"
    );
  }

  await prisma.auditLog.create({
    data: {
      userId: triggeredByUserId,
      action: "PUSH_TO_VITALLY",
      entityType: "ClientAccount",
      entityId: accountId,
      metadata: {
        vitallyAccountId: context.vitallyAccountId,
        traitsPushed: context.kpis.length,
        noteCreated,
        timelineEventsCreated,
        warnings,
      },
    },
  });

  return {
    traitsPushed: context.kpis.length,
    noteCreated,
    timelineEventsCreated,
    pushedAt: pushedAt.toISOString(),
    warnings,
  };
}

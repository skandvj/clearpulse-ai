import {
  HealthStatus,
  HealthTrend,
  KPICategory,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  isPriorityNoteAuthor,
  PRIORITY_NOTE_LABEL,
} from "@/lib/priority-note-authors";
import { KPI_HEALTH_SCORING_SYSTEM } from "./prompts";
import { generateStructuredText } from "@/lib/ai/text-provider";
import { parseOrRepairStructuredJsonResponse } from "@/lib/ai/json-response";

const MAX_EVIDENCE_PER_KPI = 10;
const MAX_RECENT_SIGNALS_PER_SOURCE = 3;
const MAX_RECENT_SIGNAL_CONTENT = 700;
const MAX_EVIDENCE_CONTENT = 500;

const healthTrendValues = ["IMPROVING", "STABLE", "DECLINING"] as const;

const scoringResponseSchema = z.object({
  healthScore: z.number().min(0).max(100),
  healthTrend: z.enum(healthTrendValues),
  healthNarrative: z.string().min(1).max(3000),
  keyEvidenceIds: z.array(z.string().min(1)).min(1).max(3),
});

type ScoringSignalContext = {
  id: string;
  source: string;
  signalDate: string;
  author: string | null;
  title: string | null;
  content: string;
  highPriority: boolean;
  priorityReason: string | null;
};

type KpiEvidenceContext = ScoringSignalContext & {
  excerpt: string;
  relevance: number;
};

type NormalizedScoringResponse = {
  healthScore: number;
  healthTrend: (typeof healthTrendValues)[number];
  healthNarrative: string;
  keyEvidenceIds: string[];
};

export type HealthScoringSummary = {
  kpisScored: number;
  accountHealthScore: number | null;
  accountHealthStatus: HealthStatus;
  scoredAt: string;
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function coerceScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim().replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function coerceTrend(value: unknown): (typeof healthTrendValues)[number] | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (healthTrendValues.includes(normalized as (typeof healthTrendValues)[number])) {
    return normalized as (typeof healthTrendValues)[number];
  }
  return null;
}

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
}

function normalizeScoringResponse(
  parsed: unknown,
  fallbackEvidenceIds: string[]
): NormalizedScoringResponse {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid health scoring schema: response must be a JSON object");
  }

  const source = parsed as Record<string, unknown>;
  const healthScore = coerceScore(source.healthScore);
  const healthTrend =
    coerceTrend(source.healthTrend) ??
    coerceTrend(source.trend) ??
    "STABLE";
  const healthNarrative =
    typeof source.healthNarrative === "string"
      ? source.healthNarrative.trim()
      : typeof source.narrative === "string"
        ? source.narrative.trim()
        : "";

  const keyEvidenceIds = [
    ...coerceStringArray(source.keyEvidenceIds),
    ...coerceStringArray(source.keyEvidenceId),
    ...coerceStringArray(source.keySignals),
  ].filter((value, index, values) => values.indexOf(value) === index);

  return {
    healthScore: healthScore ?? 50,
    healthTrend,
    healthNarrative:
      healthNarrative ||
      "The available account evidence was enough to produce a directional score, but the model did not return a full narrative. Review the linked signals before relying on this assessment.",
    keyEvidenceIds: (keyEvidenceIds.length > 0
      ? keyEvidenceIds
      : fallbackEvidenceIds
    ).slice(0, 3),
  };
}

function deriveHealthStatus(score: number | null): HealthStatus {
  if (score == null) return "UNKNOWN";
  if (score >= 70) return "HEALTHY";
  if (score >= 40) return "AT_RISK";
  return "CRITICAL";
}

function normalizePersonName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getPriorityReason(
  author: string | null,
  priorityNames: string[]
): string | null {
  const normalizedAuthor = normalizePersonName(author ?? "");
  if (!normalizedAuthor) return null;

  if (isPriorityNoteAuthor(author)) {
    return PRIORITY_NOTE_LABEL;
  }

  const matchedContact = priorityNames.find((name) => {
    if (name.length < 3 || normalizedAuthor.length < 3) return false;
    return normalizedAuthor.includes(name) || name.includes(normalizedAuthor);
  });

  return matchedContact ? "Key account contact" : null;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function toSignalContext(
  signal: {
    id: string;
    source: string;
    signalDate: Date;
    author: string | null;
    title: string | null;
    content: string;
  },
  priorityNames: string[]
): ScoringSignalContext {
  const priorityReason = getPriorityReason(signal.author, priorityNames);

  return {
    id: signal.id,
    source: signal.source,
    signalDate: signal.signalDate.toISOString(),
    author: signal.author,
    title: signal.title,
    content: truncate(signal.content, MAX_RECENT_SIGNAL_CONTENT),
    highPriority: !!priorityReason,
    priorityReason,
  };
}

function buildEvidenceContext(
  evidenceRows: Array<{
    excerpt: string;
    relevance: number;
    signal: {
      id: string;
      source: string;
      signalDate: Date;
      author: string | null;
      title: string | null;
      content: string;
    };
  }>,
  priorityNames: string[]
): KpiEvidenceContext[] {
  return evidenceRows.slice(0, MAX_EVIDENCE_PER_KPI).map((row) => {
    const signal = toSignalContext(row.signal, priorityNames);

    return {
      ...signal,
      content: truncate(row.signal.content, MAX_EVIDENCE_CONTENT),
      excerpt: truncate(row.excerpt, 280),
      relevance: row.relevance,
    };
  });
}

function selectRecentSignalsBySource(
  rows: Array<{
    id: string;
    source: string;
    signalDate: Date;
    author: string | null;
    title: string | null;
    content: string;
  }>,
  priorityNames: string[]
): ScoringSignalContext[] {
  const bySource = new Map<string, ScoringSignalContext[]>();

  for (const row of rows) {
    const current = bySource.get(row.source) ?? [];
    if (current.length >= MAX_RECENT_SIGNALS_PER_SOURCE) continue;

    current.push(toSignalContext(row, priorityNames));
    bySource.set(row.source, current);
  }

  return Array.from(bySource.values()).flat();
}

async function scoreSingleKpi(input: {
  account: {
    id: string;
    name: string;
    tier: string | null;
    industry: string | null;
    currentSolution: string | null;
    currentState: string | null;
    businessGoals: string | null;
    objectives: string | null;
    roadblocks: string | null;
    implementationPlan: string | null;
  };
  kpi: {
    id: string;
    metricName: string;
    targetValue: string | null;
    currentValue: string | null;
    unit: string | null;
    category: KPICategory;
    status: string;
    notes: string | null;
  };
  evidenceSignals: KpiEvidenceContext[];
  recentSignals: ScoringSignalContext[];
}): Promise<{
  healthScore: number;
  healthStatus: HealthStatus;
  healthTrend: HealthTrend;
  healthNarrative: string;
  keyEvidenceIds: string[];
}> {
  const validSignalIds = new Set([
    ...input.evidenceSignals.map((signal) => signal.id),
    ...input.recentSignals.map((signal) => signal.id),
  ]);
  const fallbackEvidenceIds = input.evidenceSignals
    .map((signal) => signal.id)
    .slice(0, 3);

  if (validSignalIds.size === 0) {
    return {
      healthScore: 50,
      healthStatus: "UNKNOWN",
      healthTrend: "STABLE",
      healthNarrative:
        "There are not enough recent signals to score this KPI confidently yet. Trigger a sync or review account evidence to produce a stronger health assessment.",
      keyEvidenceIds: [],
    };
  }

  const response = await generateStructuredText({
    system: KPI_HEALTH_SCORING_SYSTEM,
    prompt: JSON.stringify({
      account: input.account,
      kpi: input.kpi,
      evidenceSignals: input.evidenceSignals,
      recentSignals: input.recentSignals,
    }),
    maxOutputTokens: 1400,
  });

  let parsed: unknown;
  try {
    parsed = await parseOrRepairStructuredJsonResponse({
      text: response.text,
      taskLabel: "KPI health scoring",
      maxOutputTokens: 2400,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message.replace(
            "Failed to parse AI JSON output",
            "Failed to parse AI health scoring JSON output"
          )
        : "Failed to parse AI health scoring JSON output"
    );
  }

  const normalized = normalizeScoringResponse(parsed, fallbackEvidenceIds);
  const validated = scoringResponseSchema.safeParse(normalized);
  if (!validated.success) {
    throw new Error(
      `Invalid health scoring schema: ${validated.error.issues[0]?.message ?? "unknown"}`
    );
  }

  const healthScore = clampScore(validated.data.healthScore);
  const keyEvidenceIds = validated.data.keyEvidenceIds
    .filter((id) => validSignalIds.has(id))
    .slice(0, 3);

  return {
    healthScore,
    healthStatus: deriveHealthStatus(healthScore),
    healthTrend: validated.data.healthTrend,
    healthNarrative: validated.data.healthNarrative.trim(),
    keyEvidenceIds,
  };
}

function getCategoryWeight(category: KPICategory): number {
  switch (category) {
    case "REVENUE":
    case "RETENTION":
      return 2;
    case "ADOPTION":
      return 1.5;
    default:
      return 1;
  }
}

export async function runAccountHealthScoring(
  accountId: string,
  changedByUserId: string
): Promise<HealthScoringSummary> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [account, recentSignals] = await Promise.all([
    prisma.clientAccount.findUnique({
      where: { id: accountId },
      include: {
        contacts: {
          select: { name: true },
        },
        kpis: {
          include: {
            evidence: {
              include: {
                signal: {
                  select: {
                    id: true,
                    source: true,
                    signalDate: true,
                    author: true,
                    title: true,
                    content: true,
                  },
                },
              },
              orderBy: { relevance: "desc" },
            },
          },
        },
      },
    }),
    prisma.rawSignal.findMany({
      where: {
        accountId,
        signalDate: { gte: since },
      },
      orderBy: { signalDate: "desc" },
      take: 180,
      select: {
        id: true,
        source: true,
        signalDate: true,
        author: true,
        title: true,
        content: true,
      },
    }),
  ]);

  if (!account) {
    throw new Error("Account not found");
  }

  const priorityNames = account.contacts
    .map((contact) => normalizePersonName(contact.name))
    .filter(Boolean);

  const sharedRecentSignals = selectRecentSignalsBySource(
    recentSignals,
    priorityNames
  );

  const scores: Array<{
    kpiId: string;
    currentValue: string | null;
    category: KPICategory;
    healthScore: number | null;
    healthStatus: HealthStatus;
    healthTrend: HealthTrend;
    healthNarrative: string;
  }> = [];

  for (const kpi of account.kpis) {
    const evidenceSignals = buildEvidenceContext(kpi.evidence, priorityNames);
    const evidenceIds = new Set(evidenceSignals.map((signal) => signal.id));
    const recentContext = sharedRecentSignals
      .filter((signal) => !evidenceIds.has(signal.id))
      .slice(0, 12);

    if (evidenceSignals.length === 0 && recentContext.length === 0) {
      scores.push({
        kpiId: kpi.id,
        currentValue: kpi.currentValue,
        category: kpi.category,
        healthScore: null,
        healthStatus: "UNKNOWN",
        healthTrend: "STABLE",
        healthNarrative:
          "There are not enough recent signals to score this KPI confidently yet. Trigger a sync or add evidence before relying on this health indicator.",
      });
      continue;
    }

    const result = await scoreSingleKpi({
      account: {
        id: account.id,
        name: account.name,
        tier: account.tier,
        industry: account.industry,
        currentSolution: account.currentSolution,
        currentState: account.currentState,
        businessGoals: account.businessGoals,
        objectives: account.objectives,
        roadblocks: account.roadblocks,
        implementationPlan: account.implementationPlan,
      },
      kpi: {
        id: kpi.id,
        metricName: kpi.metricName,
        targetValue: kpi.targetValue,
        currentValue: kpi.currentValue,
        unit: kpi.unit,
        category: kpi.category,
        status: kpi.status,
        notes: kpi.notes,
      },
      evidenceSignals,
      recentSignals: recentContext,
    });

    scores.push({
      kpiId: kpi.id,
      currentValue: kpi.currentValue,
      category: kpi.category,
      healthScore: result.healthScore,
      healthStatus: result.healthStatus,
      healthTrend: result.healthTrend,
      healthNarrative: result.healthNarrative,
    });
  }

  const scoredKpis = scores.filter((score) => score.healthScore != null);

  const weightedTotal = scoredKpis.reduce(
    (sum, score) => sum + (score.healthScore as number) * getCategoryWeight(score.category),
    0
  );
  const totalWeight = scoredKpis.reduce(
    (sum, score) => sum + getCategoryWeight(score.category),
    0
  );

  const accountHealthScore =
    totalWeight > 0 ? clampScore(weightedTotal / totalWeight) : null;
  const accountHealthStatus = deriveHealthStatus(accountHealthScore);
  const scoredAt = new Date();

  await prisma.$transaction(async (tx) => {
    for (const score of scores) {
      const previous = account.kpis.find((kpi) => kpi.id === score.kpiId);

      await tx.clientKPI.update({
        where: { id: score.kpiId },
        data: {
          healthScore: score.healthScore,
          healthStatus: score.healthStatus,
          healthTrend: score.healthTrend,
          healthNarrative: score.healthNarrative,
          lastScoredAt: scoredAt,
        },
      });

      if (
        previous?.currentValue &&
        (previous.healthScore !== score.healthScore ||
          previous.healthStatus !== score.healthStatus)
      ) {
        await tx.kPIHistory.create({
          data: {
            kpiId: score.kpiId,
            value: previous.currentValue,
            healthScore: score.healthScore,
            healthStatus: score.healthStatus,
            changedBy: changedByUserId,
            note: "AI health re-score",
          },
        });
      }
    }

    await tx.clientAccount.update({
      where: { id: accountId },
      data: {
        healthScore: accountHealthScore,
        healthStatus: accountHealthStatus,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: changedByUserId,
        action: "ACCOUNT_HEALTH_RESCORE",
        entityType: "ClientAccount",
        entityId: accountId,
        metadata: {
          kpisScored: scores.length,
          accountHealthScore,
          accountHealthStatus,
        } as Prisma.InputJsonValue,
      },
    });
  });

  return {
    kpisScored: scores.length,
    accountHealthScore,
    accountHealthStatus,
    scoredAt: scoredAt.toISOString(),
  };
}

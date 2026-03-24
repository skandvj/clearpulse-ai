import Anthropic from "@anthropic-ai/sdk";
import {
  HealthStatus,
  HealthTrend,
  KPICategory,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { env } from "@/env";
import { prisma } from "@/lib/db";
import { KPI_HEALTH_SCORING_SYSTEM } from "./prompts";

const MODEL = "claude-sonnet-4-20250514";
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

export type HealthScoringSummary = {
  kpisScored: number;
  accountHealthScore: number | null;
  accountHealthStatus: HealthStatus;
  scoredAt: string;
};

function stripJsonFence(text: string): string {
  let value = text.trim();
  if (value.startsWith("```")) {
    value = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return value.trim();
}

function getAnthropicClient(): Anthropic {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  return new Anthropic({ apiKey: key });
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
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

  if (normalizedAuthor.includes("wendy")) {
    return "Wendy note";
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
  const client = getAnthropicClient();
  const validSignalIds = new Set([
    ...input.evidenceSignals.map((signal) => signal.id),
    ...input.recentSignals.map((signal) => signal.id),
  ]);

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

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1400,
    system: KPI_HEALTH_SCORING_SYSTEM,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          account: input.account,
          kpi: input.kpi,
          evidenceSignals: input.evidenceSignals,
          recentSignals: input.recentSignals,
        }),
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(textBlock.text));
  } catch {
    throw new Error("Failed to parse Claude health scoring JSON output");
  }

  const validated = scoringResponseSchema.safeParse(parsed);
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

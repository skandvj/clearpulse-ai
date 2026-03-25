import { HealthStatus, SignalSource } from "@prisma/client";
import { formatTierLabel } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { isPriorityNoteAuthor } from "@/lib/priority-note-authors";

export interface AccountReportKpi {
  id: string;
  metricName: string;
  targetValue: string | null;
  currentValue: string | null;
  unit: string | null;
  healthScore: number | null;
  healthStatus: HealthStatus;
  healthNarrative: string | null;
  updatedAt: string;
  evidenceCount: number;
  evidenceSources: SignalSource[];
  hasPriorityNoteEvidence: boolean;
}

export interface AccountReportContact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  isPrimary: boolean;
}

export interface AccountReportData {
  generatedAt: string;
  preparedBy: string;
  account: {
    id: string;
    name: string;
    domain: string | null;
    tier: string | null;
    tierLabel: string | null;
    industry: string | null;
    healthScore: number | null;
    healthStatus: HealthStatus;
    currentSolution: string | null;
    currentState: string | null;
    businessGoals: string | null;
    objectives: string | null;
    roadblocks: string | null;
    implementationPlan: string | null;
    lastSyncedAt: string | null;
    csm: {
      name: string | null;
      email: string;
      avatarUrl: string | null;
    } | null;
  };
  kpis: AccountReportKpi[];
  contacts: AccountReportContact[];
}

function roundScore(score: number | null): number | null {
  return score == null ? null : Math.round(score);
}

export async function loadAccountReportData(
  accountId: string,
  preparedBy: string
): Promise<AccountReportData | null> {
  const account = await prisma.clientAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      name: true,
      domain: true,
      tier: true,
      industry: true,
      healthScore: true,
      healthStatus: true,
      currentSolution: true,
      currentState: true,
      businessGoals: true,
      objectives: true,
      roadblocks: true,
      implementationPlan: true,
      lastSyncedAt: true,
      csm: {
        select: {
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          role: true,
          email: true,
          isPrimary: true,
        },
      },
      kpis: {
        orderBy: [{ metricName: "asc" }],
        select: {
          id: true,
          metricName: true,
          targetValue: true,
          currentValue: true,
          unit: true,
          healthScore: true,
          healthStatus: true,
          healthNarrative: true,
          updatedAt: true,
          _count: {
            select: {
              evidence: true,
            },
          },
          evidence: {
            take: 10,
            select: {
              signal: {
                select: {
                  source: true,
                  author: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!account) {
    return null;
  }

  return {
    generatedAt: new Date().toISOString(),
    preparedBy,
    account: {
      id: account.id,
      name: account.name,
      domain: account.domain,
      tier: account.tier,
      tierLabel: formatTierLabel(account.tier),
      industry: account.industry,
      healthScore: roundScore(account.healthScore),
      healthStatus: account.healthStatus,
      currentSolution: account.currentSolution,
      currentState: account.currentState,
      businessGoals: account.businessGoals,
      objectives: account.objectives,
      roadblocks: account.roadblocks,
      implementationPlan: account.implementationPlan,
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
      csm: account.csm,
    },
    kpis: account.kpis.map((kpi) => ({
      id: kpi.id,
      metricName: kpi.metricName,
      targetValue: kpi.targetValue,
      currentValue: kpi.currentValue,
      unit: kpi.unit,
      healthScore: roundScore(kpi.healthScore),
      healthStatus: kpi.healthStatus,
      healthNarrative: kpi.healthNarrative,
      updatedAt: kpi.updatedAt.toISOString(),
      evidenceCount: kpi._count.evidence,
      evidenceSources: Array.from(
        new Set(kpi.evidence.map((evidence) => evidence.signal.source))
      ) as SignalSource[],
      hasPriorityNoteEvidence: kpi.evidence.some((evidence) =>
        isPriorityNoteAuthor(evidence.signal.author)
      ),
    })),
    contacts: account.contacts,
  };
}

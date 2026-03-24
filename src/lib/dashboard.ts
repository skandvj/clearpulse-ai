import {
  HealthStatus,
  KPISource,
  SignalSource,
} from "@prisma/client";
import type { AuthenticatedUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";

export interface DashboardStats {
  totalAccounts: number;
  criticalAccounts: number;
  atRiskAccounts: number;
  decliningKpis: number;
}

export interface DashboardHealthMapAccount {
  id: string;
  name: string;
  healthScore: number | null;
  healthStatus: HealthStatus;
  kpiCount: number;
  signalCount: number;
  lastSyncedAt: string | null;
  csmName: string | null;
}

export interface DashboardKpiHealthSlice {
  status: Exclude<HealthStatus, "UNKNOWN">;
  label: string;
  value: number;
  color: string;
}

export type DashboardSourceActivityPoint = {
  dateKey: string;
  dateLabel: string;
} & Record<SignalSource, number>;

export interface DashboardAttentionAccount {
  id: string;
  name: string;
  healthScore: number | null;
  healthStatus: HealthStatus;
  criticalKpis: number;
  decliningKpis: number;
  lastSignalAt: string | null;
  lastMeetingAt: string | null;
  csm: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
}

export interface DashboardExtractionItem {
  id: string;
  accountId: string;
  accountName: string;
  metricName: string;
  healthStatus: HealthStatus;
  updatedAt: string;
  evidenceSources: SignalSource[];
}

export interface DashboardData {
  stats: DashboardStats;
  healthMap: DashboardHealthMapAccount[];
  kpiHealthBreakdown: DashboardKpiHealthSlice[];
  kpiUnknownCount: number;
  sourceActivity: DashboardSourceActivityPoint[];
  attentionAccounts: DashboardAttentionAccount[];
  recentExtractions: DashboardExtractionItem[];
}

const KPI_HEALTH_META: Record<
  Exclude<HealthStatus, "UNKNOWN">,
  { label: string; color: string }
> = {
  HEALTHY: { label: "Healthy", color: "#10B981" },
  AT_RISK: { label: "At Risk", color: "#F59E0B" },
  CRITICAL: { label: "Critical", color: "#EF4444" },
};

function getVisibleAccountIdsFilter(user: AuthenticatedUser) {
  return user.role === "CSM" ? { csmId: user.id } : {};
}

function startOfLocalDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function formatDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function createSourceCounts(): Record<SignalSource, number> {
  return {
    SLACK: 0,
    FATHOM: 0,
    AM_MEETING: 0,
    VITALLY: 0,
    SALESFORCE: 0,
    PERSONAS: 0,
    SHAREPOINT: 0,
    JIRA: 0,
    GOOGLE_DRIVE: 0,
  };
}

function buildSourceActivityTimeline(days: number): DashboardSourceActivityPoint[] {
  const start = startOfLocalDay(new Date());
  start.setDate(start.getDate() - (days - 1));

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      dateKey: formatDayKey(date),
      dateLabel: formatDayLabel(date),
      ...createSourceCounts(),
    };
  });
}

function roundScore(score: number | null): number | null {
  return score === null ? null : Math.round(score);
}

export async function getDashboardData(
  user: AuthenticatedUser
): Promise<DashboardData> {
  const accountWhere = getVisibleAccountIdsFilter(user);

  const accounts = await prisma.clientAccount.findMany({
    where: accountWhere,
    select: {
      id: true,
      name: true,
      healthScore: true,
      healthStatus: true,
      lastSyncedAt: true,
      csm: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      _count: {
        select: {
          kpis: true,
          signals: true,
        },
      },
    },
  });

  const sourceActivity = buildSourceActivityTimeline(14);
  const accountIds = accounts.map((account) => account.id);

  if (accountIds.length === 0) {
    return {
      stats: {
        totalAccounts: 0,
        criticalAccounts: 0,
        atRiskAccounts: 0,
        decliningKpis: 0,
      },
      healthMap: [],
      kpiHealthBreakdown: Object.entries(KPI_HEALTH_META).map(
        ([status, meta]) => ({
          status: status as Exclude<HealthStatus, "UNKNOWN">,
          label: meta.label,
          value: 0,
          color: meta.color,
        })
      ),
      kpiUnknownCount: 0,
      sourceActivity,
      attentionAccounts: [],
      recentExtractions: [],
    };
  }

  const activityStart = startOfLocalDay(new Date());
  activityStart.setDate(activityStart.getDate() - 13);

  const [kpis, recentSignals, recentExtractionsRaw] = await prisma.$transaction([
    prisma.clientKPI.findMany({
      where: {
        accountId: { in: accountIds },
      },
      select: {
        id: true,
        accountId: true,
        healthStatus: true,
        healthTrend: true,
      },
    }),
    prisma.rawSignal.findMany({
      where: {
        accountId: { in: accountIds },
        signalDate: {
          gte: activityStart,
        },
      },
      select: {
        source: true,
        signalDate: true,
      },
    }),
    prisma.clientKPI.findMany({
      where: {
        accountId: { in: accountIds },
        source: KPISource.AI_EXTRACTED,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 15,
      select: {
        id: true,
        metricName: true,
        healthStatus: true,
        updatedAt: true,
        account: {
          select: {
            id: true,
            name: true,
          },
        },
        evidence: {
          take: 6,
          select: {
            signal: {
              select: {
                source: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const breakdownCounts: Record<Exclude<HealthStatus, "UNKNOWN">, number> = {
    HEALTHY: 0,
    AT_RISK: 0,
    CRITICAL: 0,
  };
  let kpiUnknownCount = 0;
  let decliningKpis = 0;

  const attentionByAccount = new Map<
    string,
    { criticalKpis: number; decliningKpis: number }
  >();

  for (const kpi of kpis) {
    if (kpi.healthStatus === "UNKNOWN") {
      kpiUnknownCount += 1;
    } else {
      breakdownCounts[kpi.healthStatus] += 1;
    }

    if (kpi.healthTrend === "DECLINING") {
      decliningKpis += 1;
    }

    if (kpi.healthStatus === "CRITICAL" || kpi.healthTrend === "DECLINING") {
      const existing = attentionByAccount.get(kpi.accountId) ?? {
        criticalKpis: 0,
        decliningKpis: 0,
      };

      if (kpi.healthStatus === "CRITICAL") {
        existing.criticalKpis += 1;
      }

      if (kpi.healthTrend === "DECLINING") {
        existing.decliningKpis += 1;
      }

      attentionByAccount.set(kpi.accountId, existing);
    }
  }

  const activityByDate = new Map(
    sourceActivity.map((point) => [point.dateKey, point])
  );

  for (const signal of recentSignals) {
    const dayKey = formatDayKey(signal.signalDate);
    const point = activityByDate.get(dayKey);

    if (point) {
      point[signal.source] += 1;
    }
  }

  const healthMap = accounts
    .map((account) => ({
      id: account.id,
      name: account.name,
      healthScore: roundScore(account.healthScore),
      healthStatus: account.healthStatus,
      kpiCount: account._count.kpis,
      signalCount: account._count.signals,
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
      csmName: account.csm?.name ?? null,
    }))
    .sort((left, right) => {
      const leftScore = left.healthScore ?? Number.POSITIVE_INFINITY;
      const rightScore = right.healthScore ?? Number.POSITIVE_INFINITY;

      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }

      return left.name.localeCompare(right.name);
    });

  const rankedAttention = accounts
    .map((account) => {
      const counts = attentionByAccount.get(account.id);

      if (!counts) {
        return null;
      }

      return {
        id: account.id,
        name: account.name,
        healthScore: roundScore(account.healthScore),
        healthStatus: account.healthStatus,
        criticalKpis: counts.criticalKpis,
        decliningKpis: counts.decliningKpis,
        csm: account.csm,
      };
    })
    .filter(
      (
        value
      ): value is {
        id: string;
        name: string;
        healthScore: number | null;
        healthStatus: HealthStatus;
        criticalKpis: number;
        decliningKpis: number;
        csm: {
          id: string;
          name: string | null;
          email: string;
          avatarUrl: string | null;
        } | null;
      } => value !== null
    )
    .sort((left, right) => {
      if (left.criticalKpis !== right.criticalKpis) {
        return right.criticalKpis - left.criticalKpis;
      }

      if (left.decliningKpis !== right.decliningKpis) {
        return right.decliningKpis - left.decliningKpis;
      }

      const leftScore = left.healthScore ?? Number.POSITIVE_INFINITY;
      const rightScore = right.healthScore ?? Number.POSITIVE_INFINITY;

      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, 10);

  const attentionIds = rankedAttention.map((account) => account.id);

  const [lastSignals, lastMeetings] =
    attentionIds.length > 0
      ? await prisma.$transaction([
          prisma.rawSignal.groupBy({
            by: ["accountId"],
            orderBy: {
              accountId: "asc",
            },
            where: {
              accountId: {
                in: attentionIds,
              },
            },
            _max: {
              signalDate: true,
            },
          }),
          prisma.meeting.groupBy({
            by: ["accountId"],
            orderBy: {
              accountId: "asc",
            },
            where: {
              accountId: {
                in: attentionIds,
              },
            },
            _max: {
              meetingDate: true,
            },
          }),
        ])
      : [[], []];

  const lastSignalByAccount = new Map(
    lastSignals.map((row) => [
      row.accountId,
      row._max?.signalDate?.toISOString() ?? null,
    ])
  );
  const lastMeetingByAccount = new Map(
    lastMeetings.map((row) => [
      row.accountId,
      row._max?.meetingDate?.toISOString() ?? null,
    ])
  );

  const attentionAccounts: DashboardAttentionAccount[] = rankedAttention.map(
    (account) => ({
      ...account,
      lastSignalAt: lastSignalByAccount.get(account.id) ?? null,
      lastMeetingAt: lastMeetingByAccount.get(account.id) ?? null,
    })
  );

  const recentExtractions: DashboardExtractionItem[] = recentExtractionsRaw.map(
    (kpi) => ({
      id: kpi.id,
      accountId: kpi.account.id,
      accountName: kpi.account.name,
      metricName: kpi.metricName,
      healthStatus: kpi.healthStatus,
      updatedAt: kpi.updatedAt.toISOString(),
      evidenceSources: Array.from(
        new Set(kpi.evidence.map((evidence) => evidence.signal.source))
      ).slice(0, 3),
    })
  );

  return {
    stats: {
      totalAccounts: accounts.length,
      criticalAccounts: accounts.filter(
        (account) => account.healthStatus === "CRITICAL"
      ).length,
      atRiskAccounts: accounts.filter(
        (account) => account.healthStatus === "AT_RISK"
      ).length,
      decliningKpis,
    },
    healthMap,
    kpiHealthBreakdown: (
      Object.entries(KPI_HEALTH_META) as Array<
        [Exclude<HealthStatus, "UNKNOWN">, { label: string; color: string }]
      >
    ).map(([status, meta]) => ({
      status,
      label: meta.label,
      value: breakdownCounts[status],
      color: meta.color,
    })),
    kpiUnknownCount,
    sourceActivity,
    attentionAccounts,
    recentExtractions,
  };
}

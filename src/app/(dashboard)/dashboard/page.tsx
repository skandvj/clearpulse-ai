import Link from "next/link";
import { redirect } from "next/navigation";
import { PageWrapper } from "@/components/layout/page-wrapper";
import { BrandMark } from "@/components/brand/brand-mark";
import {
  LazyKpiHealthBreakdownChart,
  LazySourceActivityChart,
} from "@/components/dashboard/lazy-portfolio-charts";
import { SyncTriggerButton } from "@/components/signals/sync-trigger-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HealthStatusBadge } from "@/components/ui/health-badge";
import { HealthRing } from "@/components/ui/health-ring";
import { getServerUser } from "@/lib/auth-helpers";
import { getDashboardData } from "@/lib/dashboard";
import { PERMISSIONS, hasPermission } from "@/lib/rbac";
import { ArrowRight, ExternalLink, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "Never";

  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name?: string | null): string {
  if (!name) return "NA";

  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getHealthBarClasses(score: number | null): string {
  if (score === null) {
    return "bg-gray-300";
  }

  if (score >= 70) {
    return "bg-emerald-500";
  }

  if (score >= 40) {
    return "bg-amber-500";
  }

  return "bg-red-500";
}

function formatSourceLabel(source: string): string {
  return source
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function DashboardPage() {
  const user = await getServerUser();

  if (!user) {
    redirect("/login");
  }

  const data = await getDashboardData(user);
  const canTriggerSync = hasPermission(
    user.role,
    PERMISSIONS.TRIGGER_SOURCE_SYNC
  );

  const stats = [
    {
      label: "Total Active Accounts",
      value: data.stats.totalAccounts,
      tone: "text-slate-950",
      detail: "Accounts live inside this workspace",
    },
    {
      label: "Accounts Critical",
      value: data.stats.criticalAccounts,
      tone: "text-red-600",
      detail: "Need executive attention first",
    },
    {
      label: "Accounts At Risk",
      value: data.stats.atRiskAccounts,
      tone: "text-amber-600",
      detail: "Recovery plans in progress",
    },
    {
      label: "KPIs Declining",
      value: data.stats.decliningKpis,
      tone: "text-orange-600",
      detail: "Signals trending down this cycle",
    },
  ];

  const workspaceLabel = user.organizationName.replace(/ Workspace$/i, "");

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-[36px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.92)_44%,rgba(224,242,254,0.86))] p-7 shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.18),transparent_64%)] lg:block" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge className="rounded-full border-0 bg-slate-950 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white shadow-none">
                <BrandMark alt="" className="mr-1.5 h-3 w-3" />
                {workspaceLabel}
              </Badge>
              <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                Portfolio command center
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-[15px]">
                Monitor health, signal flow, and KPI movement from one premium workspace.
                Account data, admin settings, and audit records stay isolated to{" "}
                {user.organizationName}.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href="/accounts">
                    Open accounts
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/admin/integrations">Review integrations</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:max-w-[360px] lg:grid-cols-1">
              <div className="glass-panel-soft rounded-[26px] p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Tenant boundary
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Credentials, integrations, and sync jobs are scoped to this org.
                </p>
              </div>
              <div className="glass-panel-soft rounded-[26px] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  Activity window
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Charts below reflect the latest 14-day signal cadence across connected sources.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    {stat.label}
                  </p>
                  <p className={`text-3xl font-semibold tracking-tight ${stat.tone}`}>
                    {stat.value}
                  </p>
                  <p className="text-sm leading-6 text-slate-500">{stat.detail}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                Portfolio Health Map
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.healthMap.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
                  No accounts yet.
                </div>
              ) : (
                <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                  {data.healthMap.map((account) => (
                    <Link
                      key={account.id}
                      href={`/accounts/${account.id}`}
                      className="block rounded-[24px] border border-white/80 bg-white/70 p-4 transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-semibold text-slate-900">
                              {account.name}
                            </p>
                            <HealthStatusBadge status={account.healthStatus} />
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {account.kpiCount} KPI
                            {account.kpiCount === 1 ? "" : "s"} ·{" "}
                            {account.signalCount} signal
                            {account.signalCount === 1 ? "" : "s"} · Last sync{" "}
                            {formatRelative(account.lastSyncedAt)}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Health
                          </p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            {account.healthScore ?? "—"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100/90">
                          <div
                            className={`h-full rounded-full ${getHealthBarClasses(
                              account.healthScore
                            )}`}
                            style={{
                              width: `${account.healthScore ?? 0}%`,
                            }}
                          />
                        </div>
                        <span className="min-w-[72px] text-right text-xs font-medium text-slate-500">
                          {account.csmName ?? "Unassigned"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                KPI Health Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LazyKpiHealthBreakdownChart data={data.kpiHealthBreakdown} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                Source Signal Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LazySourceActivityChart data={data.sourceActivity} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                Recent AI Extractions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.recentExtractions.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
                  No extractions yet.
                </div>
              ) : (
                data.recentExtractions.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[24px] border border-white/80 bg-white/75 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          href={`/accounts/${item.accountId}`}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 hover:text-slate-700"
                        >
                          {item.accountName}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <p className="mt-1 truncate text-sm text-slate-600">
                          {item.metricName}
                        </p>
                      </div>
                      <HealthStatusBadge status={item.healthStatus} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-slate-50 text-slate-600"
                      >
                        AI Extracted
                      </Badge>
                      {item.evidenceSources.map((source) => (
                        <Badge
                          key={source}
                          variant="outline"
                          className="border-slate-200 bg-white text-slate-600"
                        >
                          {formatSourceLabel(source)}
                        </Badge>
                      ))}
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      Updated {formatRelative(item.updatedAt)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Accounts Needing Attention
              </CardTitle>
            </div>

            <Button asChild className="w-fit">
              <Link href="/accounts">
                Open full account list
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.attentionAccounts.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">
                Nothing flagged right now.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-medium text-slate-500">
                      <th className="pb-3 font-medium">Account</th>
                      <th className="pb-3 font-medium">Health</th>
                      <th className="pb-3 font-medium">Critical KPIs</th>
                      <th className="pb-3 font-medium">Declining KPIs</th>
                      <th className="pb-3 font-medium">Last Signal</th>
                      <th className="pb-3 font-medium">Last Meeting</th>
                      <th className="pb-3 font-medium">CSM</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.attentionAccounts.map((account) => (
                      <tr key={account.id} className="align-middle">
                        <td className="py-4 pr-4">
                          <div className="space-y-1">
                            <Link
                              href={`/accounts/${account.id}`}
                              className="font-semibold text-slate-900 hover:text-slate-700"
                            >
                              {account.name}
                            </Link>
                            <div>
                              <HealthStatusBadge status={account.healthStatus} />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          {account.healthScore === null ? (
                            <span className="text-slate-400">Not scored</span>
                          ) : (
                            <div className="flex items-center gap-3">
                              <HealthRing
                                score={account.healthScore}
                                size={40}
                                strokeWidth={3}
                              />
                            </div>
                          )}
                        </td>
                        <td className="py-4 pr-4 font-medium text-slate-900">
                          {account.criticalKpis}
                        </td>
                        <td className="py-4 pr-4 font-medium text-slate-900">
                          {account.decliningKpis}
                        </td>
                        <td className="py-4 pr-4 text-slate-600">
                          {formatRelative(account.lastSignalAt)}
                        </td>
                        <td className="py-4 pr-4 text-slate-600">
                          {formatRelative(account.lastMeetingAt)}
                        </td>
                        <td className="py-4 pr-4">
                          {account.csm ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                {account.csm.avatarUrl ? (
                                  <AvatarImage
                                    src={account.csm.avatarUrl}
                                    alt={account.csm.name ?? account.csm.email}
                                  />
                                ) : null}
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(account.csm.name ?? account.csm.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-900">
                                  {account.csm.name ?? account.csm.email}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Unassigned</span>
                          )}
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button asChild size="sm">
                              <Link href={`/accounts/${account.id}`}>View</Link>
                            </Button>
                            {canTriggerSync ? (
                              <SyncTriggerButton
                                accountId={account.id}
                                variant="outline"
                                size="sm"
                                className="h-9"
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}

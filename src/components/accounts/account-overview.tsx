"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  ExternalLink,
} from "lucide-react";
import { useAccount } from "@/lib/hooks/use-accounts";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { HealthRing } from "@/components/ui/health-ring";
import { HealthStatusBadge } from "@/components/ui/health-badge";
import { CollapsibleSection } from "./collapsible-section";
import { InlineEditField } from "./inline-edit-field";
import { KPITable } from "./kpi-table";
import { ContactsGrid } from "./contacts-grid";
import { formatTierLabel } from "@/lib/accounts";

// ── Types matching Prisma models ────────────────────────────────────────────

export interface KPI {
  id: string;
  accountId: string;
  metricName: string;
  targetValue: string | null;
  currentValue: string | null;
  unit: string | null;
  category: string;
  source: string | null;
  status: string | null;
  healthScore: number | null;
  healthStatus: string | null;
  healthNarrative: string | null;
  healthTrend: string | null;
  lastScoredAt: string | null;
  videoTimestamp: number | null;
  videoClipUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { evidence: number };
}

export interface Contact {
  id: string;
  accountId: string;
  name: string;
  role: string | null;
  email: string | null;
  isPrimary: boolean;
}

export interface Meeting {
  id: string;
  fathomId: string | null;
  accountId: string;
  title: string;
  recordingUrl: string | null;
  summaryAI: string | null;
  duration: number | null;
  meetingDate: string;
  syncedToVitally: boolean;
  extractedKPIs: boolean;
  participants: string[];
  createdAt: string;
}

interface AccountCSM {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface AccountDetail {
  id: string;
  name: string;
  domain: string | null;
  tier: string | null;
  industry: string | null;
  healthScore: number | null;
  healthStatus: string;
  csmId: string | null;
  csm: AccountCSM | null;
  lastSyncedAt: string | null;
  currentSolution: string | null;
  currentState: string | null;
  businessGoals: string | null;
  objectives: string | null;
  roadblocks: string | null;
  implementationPlan: string | null;
  kpis: KPI[];
  contacts: Contact[];
  meetings: Meeting[];
  _count: { kpis: number; signals: number };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Component ───────────────────────────────────────────────────────────────

interface AccountOverviewProps {
  accountId: string;
}

export function AccountOverview({ accountId }: AccountOverviewProps) {
  const router = useRouter();
  const { data: account, isLoading, error } =
    useAccount<AccountDetail>(accountId);
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const canEdit = can(PERMISSIONS.EDIT_ACCOUNT_FIELDS);
  const canEditKpis = can(PERMISSIONS.EDIT_KPIS);
  const canViewEvidence = can(PERMISSIONS.VIEW_SIGNAL_EVIDENCE);
  const canRescoreHealth = can(PERMISSIONS.RUN_HEALTH_RESCORE);
  const canTriggerSync = can(PERMISSIONS.TRIGGER_SOURCE_SYNC);

  const extractKpis = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/accounts/${accountId}/extract`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Extraction failed");
      }
      return body as {
        kpisCreated: number;
        kpisUpdated: number;
        evidenceRows: number;
        signalsMarkedProcessed: number;
        meetingsMarkedExtracted: number;
        chunksProcessed: number;
        scoring?: {
          kpisScored: number;
          accountHealthScore: number | null;
          accountHealthStatus: string;
          scoredAt: string;
        };
        scoringError?: string;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts", accountId] });
      const baseMessage = `KPI extraction complete: ${data.kpisCreated} created, ${data.kpisUpdated} updated`;
      const meetingMessage =
        data.meetingsMarkedExtracted > 0
          ? ` Tagged ${data.meetingsMarkedExtracted} meeting${data.meetingsMarkedExtracted === 1 ? "" : "s"}.`
          : "";

      if (data.scoring) {
        toast.success(
          `${baseMessage}.${meetingMessage} Re-scored ${data.scoring.kpisScored} KPI(s).`
        );
        return;
      }

      if (data.scoringError) {
        toast.warning(`${baseMessage}.${meetingMessage} ${data.scoringError}`);
        return;
      }

      toast.success(`${baseMessage}.${meetingMessage}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "KPI extraction failed");
    },
  });

  const rescoreHealth = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/accounts/${accountId}/score`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Health re-score failed");
      }
      return body as {
        kpisScored: number;
        accountHealthScore: number | null;
        accountHealthStatus: string;
        scoredAt: string;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts", accountId] });
      const scoreLabel =
        data.accountHealthScore != null ? ` Account score ${data.accountHealthScore}.` : "";
      toast.success(`Re-scored ${data.kpisScored} KPI(s).${scoreLabel}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Health re-score failed");
    },
  });

  const generateReport = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/accounts/${accountId}/report/generate`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Report generation failed");
      }
      return body as {
        signedUrl: string;
        fileName: string;
        snapshotId: string;
        version: number;
        generatedAt: string;
        scoringRefreshed: boolean;
        warning?: string | null;
      };
    },
    onSuccess: (data) => {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      toast.success(`Report ready: v${data.version}`);
      if (data.warning) {
        toast.warning(data.warning);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Report generation failed");
    },
  });

  const pushToVitally = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/accounts/${accountId}/vitally/push`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Vitally push failed");
      }
      return body as {
        traitsPushed: number;
        noteCreated: boolean;
        timelineEventsCreated: number;
        pushedAt: string;
        warnings: string[];
      };
    },
    onSuccess: (data) => {
      toast.success(
        `Vitally updated: ${data.traitsPushed} KPI trait${data.traitsPushed === 1 ? "" : "s"} pushed.`
      );
      if (data.warnings.length > 0) {
        toast.warning(data.warnings.join(" "));
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Vitally push failed");
    },
  });

  const updateField = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Update failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts", accountId] });
      toast.success("Account updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update account");
    },
  });

  const saveField = (field: string) => async (value: string) => {
    await updateField.mutateAsync({ [field]: value });
  };

  if (isLoading) {
    return <AccountSkeleton />;
  }

  if (error || !account) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertTriangle className="mb-3 h-10 w-10 text-destructive/60" />
        <p className="text-lg font-medium">Failed to load account</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error?.message || "Account not found"}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/accounts")}
        >
          Back to Accounts
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <HealthRing score={account.healthScore ?? 0} size={56} />
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
                    {account.name}
                  </h1>
                  <HealthStatusBadge
                    status={
                      account.healthStatus as
                        | "HEALTHY"
                        | "AT_RISK"
                        | "CRITICAL"
                        | "UNKNOWN"
                    }
                  />
                  {account.tier && (
                    <Badge variant="secondary">
                      {formatTierLabel(account.tier)}
                    </Badge>
                  )}
                </div>
                {account.industry && (
                  <p className="text-sm text-muted-foreground">
                    {account.industry}
                  </p>
                )}
                {account.csm && (
                  <div className="flex items-center gap-2 pt-1">
                    <Avatar className="h-6 w-6">
                      {account.csm.avatarUrl && (
                        <AvatarImage src={account.csm.avatarUrl} />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {getInitials(account.csm.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">
                      {account.csm.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {can(PERMISSIONS.EDIT_ACCOUNT_FIELDS) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/accounts/${accountId}/edit`)}
                >
                  Edit
                </Button>
              )}
              {canRescoreHealth && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={rescoreHealth.isPending}
                  onClick={() => rescoreHealth.mutate()}
                >
                  {rescoreHealth.isPending ? "Scoring…" : "Re-score Health"}
                </Button>
              )}
              {canTriggerSync && (
                <Button
                  variant="default"
                  size="sm"
                  disabled={extractKpis.isPending}
                  onClick={() => extractKpis.mutate()}
                >
                  Extract KPIs
                </Button>
              )}
              {can(PERMISSIONS.PUSH_TO_VITALLY) && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pushToVitally.isPending}
                  onClick={() => pushToVitally.mutate()}
                >
                  {pushToVitally.isPending ? "Pushing…" : "Push to Vitally"}
                </Button>
              )}
              {can(PERMISSIONS.DOWNLOAD_PDF_REPORT) && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={generateReport.isPending}
                  onClick={() => generateReport.mutate()}
                >
                  {generateReport.isPending ? "Generating Report…" : "Download Report"}
                </Button>
              )}
            </div>
          </div>

          {account.lastSyncedAt && (
            <div className="mt-4 flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last synced {formatRelative(account.lastSyncedAt)}
            </div>
          )}
        </CardContent>
      </Card>

      <CollapsibleSection title="Solution Summary" defaultOpen>
        <InlineEditField
          value={account.currentSolution}
          onSave={saveField("currentSolution")}
          canEdit={canEdit}
          placeholder="Describe the current solution..."
        />
      </CollapsibleSection>

      <CollapsibleSection title="Current State" defaultOpen>
        <InlineEditField
          value={account.currentState}
          onSave={saveField("currentState")}
          canEdit={canEdit}
          placeholder="Describe the current state..."
        />
      </CollapsibleSection>

      <CollapsibleSection title="Business Goals" defaultOpen>
        <InlineEditField
          value={account.businessGoals}
          onSave={saveField("businessGoals")}
          canEdit={canEdit}
          placeholder="Define business goals..."
        />
      </CollapsibleSection>

      <CollapsibleSection title="Objectives" defaultOpen>
        <InlineEditField
          value={account.objectives}
          onSave={saveField("objectives")}
          canEdit={canEdit}
          placeholder="List objectives..."
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="KPIs"
        defaultOpen
        badge={
          <Badge variant="secondary" className="ml-1 text-xs">
            {account.kpis.length}
          </Badge>
        }
      >
        <KPITable
          accountId={accountId}
          kpis={account.kpis}
          canEdit={canEditKpis}
          canViewEvidence={canViewEvidence}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Implementation Plan" defaultOpen={false}>
        <InlineEditField
          value={account.implementationPlan}
          onSave={saveField("implementationPlan")}
          canEdit={canEdit}
          placeholder="Outline the implementation plan..."
        />
      </CollapsibleSection>

      <CollapsibleSection title="Roadblocks" defaultOpen={false}>
        <InlineEditField
          value={account.roadblocks}
          onSave={saveField("roadblocks")}
          canEdit={canEdit}
          placeholder="Note any roadblocks..."
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Key Contacts"
        defaultOpen
        badge={
          <Badge variant="secondary" className="ml-1 text-xs">
            {account.contacts.length}
          </Badge>
        }
      >
        <ContactsGrid
          accountId={accountId}
          contacts={account.contacts}
          canEdit={canEdit}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Meeting History"
        defaultOpen={false}
        badge={
          <Badge variant="secondary" className="ml-1 text-xs">
            {account.meetings.length}
          </Badge>
        }
      >
        {account.meetings.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground">No meetings yet.</div>
        ) : (
          <div className="space-y-3">
            {account.meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="flex items-start gap-3 rounded-lg border border-gray-100 p-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <CalendarDays className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                            <Link
                              href={`/accounts/${accountId}/meetings/${meeting.id}`}
                              className="truncate font-medium text-sm text-slate-900 hover:text-blue-600"
                            >
                              {meeting.title}
                            </Link>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatDate(meeting.meetingDate)}
                            </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    {meeting.duration != null && (
                      <span>{meeting.duration} min</span>
                    )}
                    {meeting.participants?.length > 0 && (
                      <span>
                        {meeting.participants.length} participant
                        {meeting.participants.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {meeting.summaryAI && (
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {meeting.summaryAI.length > 150
                        ? `${meeting.summaryAI.slice(0, 150)}...`
                        : meeting.summaryAI}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {meeting.syncedToVitally && (
                      <Badge variant="outline" className="text-[10px]">
                        Synced to Vitally
                      </Badge>
                    )}
                    {meeting.extractedKPIs && (
                      <Badge variant="outline" className="text-[10px]">
                        KPIs Extracted
                      </Badge>
                    )}
                    {meeting.recordingUrl && (
                      <a
                        href={meeting.recordingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Recording
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {account.meetings.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <Button asChild variant="outline" size="sm">
              <Link href={`/accounts/${accountId}/meetings`}>
                View Full Meeting Archive
              </Link>
            </Button>
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}

// ── Loading Skeleton ────────────────────────────────────────────────────────

function AccountSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
        </CardContent>
      </Card>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-16 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

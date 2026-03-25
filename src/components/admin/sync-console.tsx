"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { useSyncJobs, useTriggerSync } from "@/lib/hooks/use-signals";
import { SourceBadge, type SignalSource } from "@/components/ui/source-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SOURCES: SignalSource[] = [
  "SLACK",
  "FATHOM",
  "AM_MEETING",
  "VITALLY",
  "SALESFORCE",
  "PERSONAS",
  "SHAREPOINT",
  "JIRA",
  "GOOGLE_DRIVE",
];

const STATUS_OPTIONS = [
  "ALL",
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
] as const;

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return "—";

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diff = Math.max(0, end - start);
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainderSeconds}s`;

  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  return `${hours}h ${remainderMinutes}m`;
}

function JobStatusBadge({
  status,
}: {
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
}) {
  if (status === "COMPLETED") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        Completed
      </Badge>
    );
  }

  if (status === "RUNNING") {
    return (
      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
        Running
      </Badge>
    );
  }

  if (status === "FAILED") {
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
        Failed
      </Badge>
    );
  }

  return (
    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
      Pending
    </Badge>
  );
}

export function AdminSyncConsole() {
  const [accountId, setAccountId] = useState<string>("");
  const [accountSource, setAccountSource] = useState<string>("ALL");
  const [sweepSource, setSweepSource] = useState<SignalSource>("SLACK");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const { data: accounts = [], isLoading: accountsLoading } = useAccounts({
    sortBy: "name",
    sortOrder: "asc",
  });
  const jobsQuery = useSyncJobs(
    {
      page,
      pageSize: 25,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      source: sourceFilter === "ALL" ? undefined : sourceFilter,
    },
    { refetchInterval: 5000 }
  );
  const triggerSync = useTriggerSync();

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? null,
    [accountId, accounts]
  );

  const totalPages = jobsQuery.data
    ? Math.max(1, Math.ceil(jobsQuery.data.total / jobsQuery.data.pageSize))
    : 1;

  const handleAccountSync = () => {
    if (!accountId) {
      toast.error("Select an account first");
      return;
    }

    triggerSync.mutate(
      {
        accountId,
        source:
          accountSource === "ALL"
            ? undefined
            : (accountSource as SignalSource),
      },
      {
        onSuccess: (data) => {
          if (data.mode === "queued") {
            toast.success(
              `Queued ${data.jobs.length} sync job${data.jobs.length === 1 ? "" : "s"} for ${selectedAccount?.name ?? "account"}`
            );
            return;
          }

          const totalNew = data.results.reduce(
            (sum, result) => sum + result.newSignals,
            0
          );
          toast.success(
            `Ran inline sync for ${selectedAccount?.name ?? "account"}: ${totalNew} new signal${totalNew === 1 ? "" : "s"}`
          );
        },
        onError: (error) => {
          toast.error(error.message || "Failed to trigger account sync");
        },
      }
    );
  };

  const handleSourceSweep = () => {
    triggerSync.mutate(
      { source: sweepSource },
      {
        onSuccess: (data) => {
          if (data.mode === "queued") {
            toast.success(
              `Queued ${data.jobs.length} ${sweepSource} sync job${data.jobs.length === 1 ? "" : "s"} across ${data.accountCount ?? data.jobs.length} account${(data.accountCount ?? data.jobs.length) === 1 ? "" : "s"}`
            );
            return;
          }

          const totalNew = data.results.reduce(
            (sum, result) => sum + result.newSignals,
            0
          );
          toast.success(
            `Completed inline ${sweepSource} sweep across ${data.accountCount ?? 0} account${(data.accountCount ?? 0) === 1 ? "" : "s"}: ${totalNew} new signal${totalNew === 1 ? "" : "s"}`
          );
        },
        onError: (error) => {
          toast.error(error.message || "Failed to trigger source sweep");
        },
      }
    );
  };

  const rerunJob = (job: { accountId: string | null; source: SignalSource }) => {
    if (!job.accountId) {
      toast.error("This job is missing an account target");
      return;
    }

    triggerSync.mutate(
      { accountId: job.accountId, source: job.source },
      {
        onSuccess: () => {
          toast.success(`Re-queued ${job.source} for the selected account`);
        },
        onError: (error) => {
          toast.error(error.message || "Failed to re-run job");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-slate-600">
        {jobsQuery.data?.queueMode === "queued" ? "Queued" : "Inline"} mode ·{" "}
        {jobsQuery.data?.summary.pending ?? 0} pending ·{" "}
        {jobsQuery.data?.summary.running ?? 0} running ·{" "}
        {jobsQuery.data?.summary.failed ?? 0} failed
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Account sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Account</p>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        accountsLoading ? "Loading accounts..." : "Select an account"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Source</p>
                <Select value={accountSource} onValueChange={setAccountSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="All sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Sources</SelectItem>
                    {SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleAccountSync}
              disabled={triggerSync.isPending || !accountId}
            >
              <RefreshCw
                className={`h-4 w-4 ${triggerSync.isPending ? "animate-spin" : ""}`}
              />
              {triggerSync.isPending ? "Starting…" : "Run sync"}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Source sweep</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Source</p>
              <Select
                value={sweepSource}
                onValueChange={(value) => setSweepSource(value as SignalSource)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a source" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full gap-2"
              variant="outline"
              onClick={handleSourceSweep}
              disabled={triggerSync.isPending}
            >
              {triggerSync.isPending ? "Starting…" : "Run sweep"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <CardTitle className="text-base font-semibold">Jobs</CardTitle>

          <div className="grid w-full gap-3 md:w-auto md:grid-cols-2">
            <Select
              value={sourceFilter}
              onValueChange={(value) => {
                setPage(1);
                setSourceFilter(value);
              }}
            >
              <SelectTrigger className="md:w-[180px]">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Sources</SelectItem>
                {SOURCES.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setPage(1);
                setStatusFilter(value);
              }}
            >
              <SelectTrigger className="md:w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === "ALL" ? "All Statuses" : status.toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {jobsQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              Loading jobs…
            </div>
          ) : jobsQuery.error ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              {jobsQuery.error.message || "Failed to load jobs"}
            </div>
          ) : jobsQuery.data && jobsQuery.data.jobs.length > 0 ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>Source</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Signals</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobsQuery.data.jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <SourceBadge source={job.source} />
                      </TableCell>
                      <TableCell>
                        {job.account ? (
                          <Link
                            href={`/accounts/${job.account.id}`}
                            className="font-medium text-slate-900 hover:text-blue-600"
                          >
                            {job.account.name}
                          </Link>
                        ) : (
                          <span className="text-slate-400">Unknown account</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <JobStatusBadge status={job.status} />
                      </TableCell>
                      <TableCell>{job.signalsFound ?? "—"}</TableCell>
                      <TableCell>
                        {formatDateTime(job.startedAt ?? job.createdAt)}
                      </TableCell>
                      <TableCell>
                        {formatDuration(job.startedAt, job.completedAt)}
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        <span className="line-clamp-2 text-sm text-slate-500">
                          {job.error || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {job.status === "FAILED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rerunJob(job)}
                            disabled={triggerSync.isPending}
                          >
                            Retry
                          </Button>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Showing {(page - 1) * (jobsQuery.data.pageSize ?? 25) + 1}-
                  {Math.min(page * (jobsQuery.data.pageSize ?? 25), jobsQuery.data.total)} of{" "}
                  {jobsQuery.data.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              No jobs yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { useAuditLogs } from "@/lib/hooks/use-audit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMetadata(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "—";
  }
}

function buildExportUrl(filters: {
  userId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const params = new URLSearchParams();

  if (filters.userId) params.set("userId", filters.userId);
  if (filters.action) params.set("action", filters.action);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  params.set("format", "csv");

  return `/api/admin/audit?${params.toString()}`;
}

export function AuditLogViewer() {
  const [userId, setUserId] = useState("ALL");
  const [action, setAction] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const filters = {
    userId: userId === "ALL" ? undefined : userId,
    action: action === "ALL" ? undefined : action,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 25,
  };

  const logsQuery = useAuditLogs(filters);
  const totalPages = logsQuery.data
    ? Math.max(1, Math.ceil(logsQuery.data.total / logsQuery.data.pageSize))
    : 1;
  const summary = useMemo(
    () => ({
      total: logsQuery.data?.total ?? 0,
      users: logsQuery.data?.filterOptions.users.length ?? 0,
      actions: logsQuery.data?.filterOptions.actions.length ?? 0,
    }),
    [logsQuery.data]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Matching Events</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {summary.total}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Actors</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {summary.users}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Actions</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {summary.actions}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-3 lg:grid-cols-5">
            <Select
              value={userId}
              onValueChange={(value) => {
                setPage(1);
                setUserId(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Users</SelectItem>
                {(logsQuery.data?.filterOptions.users ?? []).map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={action}
              onValueChange={(value) => {
                setPage(1);
                setAction(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Actions</SelectItem>
                {(logsQuery.data?.filterOptions.actions ?? []).map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setPage(1);
                setDateFrom(event.target.value);
              }}
            />

            <Input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setPage(1);
                setDateTo(event.target.value);
              }}
            />

            <Button asChild variant="outline" className="gap-2">
              <a href={buildExportUrl(filters)}>
                <Download className="h-4 w-4" />
                Export CSV
              </a>
            </Button>
          </div>

          {logsQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              Loading audit log…
            </div>
          ) : logsQuery.error ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              {logsQuery.error.message || "Failed to load audit log"}
            </div>
          ) : logsQuery.data && logsQuery.data.logs.length > 0 ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>Time</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Metadata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsQuery.data.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">
                            {log.user.name || "Unnamed User"}
                          </span>
                          <span className="text-sm text-slate-500">
                            {log.user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">
                            {log.entityLabel || log.entityId}
                          </span>
                          <span className="text-sm text-slate-500">
                            {log.entityType}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[380px]">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          {formatMetadata(log.metadata)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Showing {(page - 1) * (logsQuery.data.pageSize ?? 25) + 1}-
                  {Math.min(page * (logsQuery.data.pageSize ?? 25), logsQuery.data.total)} of{" "}
                  {logsQuery.data.total}
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
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">
                No audit entries matched your filters.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

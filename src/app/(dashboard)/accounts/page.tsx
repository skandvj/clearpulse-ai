"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from "@tanstack/react-table";
import {
  Plus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

import { PageWrapper } from "@/components/layout/page-wrapper";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HealthRing } from "@/components/ui/health-ring";
import { HealthStatusBadge } from "@/components/ui/health-badge";
import { AddAccountDialog } from "@/components/accounts/add-account-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/rbac";
import {
  useAccounts,
  type Account,
  type HealthStatus,
  type Tier,
} from "@/lib/hooks/use-accounts";

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.round((now - then) / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const TIER_LABELS: Record<string, string> = {
  ENTERPRISE: "Enterprise",
  GROWTH: "Growth",
  STARTER: "Starter",
};

const TIER_STYLES: Record<string, string> = {
  ENTERPRISE: "bg-violet-50 text-violet-700 border-violet-200",
  GROWTH: "bg-blue-50 text-blue-700 border-blue-200",
  STARTER: "bg-gray-50 text-gray-600 border-gray-200",
};

// ── Custom debounce hook ─────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ── Column definitions ───────────────────────────────────────────────────────

function useColumns(): ColumnDef<Account>[] {
  const router = useRouter();

  return useMemo<ColumnDef<Account>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Account",
        cell: ({ row }) => (
          <button
            className="text-left font-semibold text-gray-900 hover:text-blue-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/accounts/${row.original.id}`);
            }}
          >
            {row.original.name}
          </button>
        ),
      },
      {
        accessorKey: "domain",
        header: "Domain",
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-500">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "tier",
        header: "Tier",
        cell: ({ getValue }) => {
          const tier = getValue() as string | null;
          if (!tier) return <span className="text-gray-400">—</span>;
          return (
            <Badge
              variant="outline"
              className={TIER_STYLES[tier] ?? ""}
            >
              {TIER_LABELS[tier] ?? tier}
            </Badge>
          );
        },
      },
      {
        accessorKey: "healthScore",
        header: "Health",
        cell: ({ getValue }) => (
          <HealthRing score={getValue() as number} size={36} strokeWidth={3} />
        ),
      },
      {
        accessorKey: "healthStatus",
        header: "Status",
        cell: ({ getValue }) => (
          <HealthStatusBadge status={getValue() as HealthStatus} />
        ),
      },
      {
        accessorKey: "csm",
        header: "CSM",
        enableSorting: false,
        cell: ({ row }) => {
          const csm = row.original.csm;
          if (!csm) return <span className="text-gray-400">Unassigned</span>;
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                {csm.avatarUrl && <AvatarImage src={csm.avatarUrl} alt={csm.name} />}
                <AvatarFallback className="text-[10px]">
                  {initials(csm.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-gray-700">{csm.name}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "lastSyncedAt",
        header: "Last Synced",
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-500">
            {relativeTime(getValue() as string | null)}
          </span>
        ),
      },
      {
        accessorFn: (row) => row._count.kpis,
        id: "kpiCount",
        header: "KPIs",
        cell: ({ getValue }) => (
          <span className="text-sm tabular-nums text-gray-700">
            {getValue() as number}
          </span>
        ),
      },
    ],
    [router]
  );
}

// ── Table skeleton ───────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-12" />
        </div>
      ))}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  hasFilters,
  onAddClick,
  canAdd,
}: {
  hasFilters: boolean;
  onAddClick: () => void;
  canAdd: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h3 className="text-lg font-semibold text-gray-900">
        {hasFilters ? "No accounts match your filters" : "No accounts yet"}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        {hasFilters
          ? "Try adjusting your search or filter criteria."
          : "Add your first client account to start tracking KPIs and ingesting signals from all 9 data sources."}
      </p>
      {!hasFilters && canAdd && (
        <Button className="mt-6 gap-2" onClick={onAddClick}>
          <Plus className="h-4 w-4" />
          Add Your First Account
        </Button>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.EDIT_ACCOUNT_FIELDS);

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [tierFilter, setTierFilter] = useState<Tier | "">("");
  const [statusFilter, setStatusFilter] = useState<HealthStatus | "">("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: accounts, isLoading } = useAccounts({
    search: debouncedSearch || undefined,
    tier: tierFilter || undefined,
    healthStatus: statusFilter || undefined,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0]?.desc ? "desc" : "asc",
  });

  const columns = useColumns();

  const table = useReactTable({
    data: accounts ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const hasFilters = !!(debouncedSearch || tierFilter || statusFilter);

  const handleRowClick = useCallback(
    (id: string) => router.push(`/accounts/${id}`),
    [router]
  );

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between rounded-[24px] border border-[#e3d8ca] bg-white p-7 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Accounts
            </p>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-gray-900">
              Accounts
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage client accounts with one calmer, shared view of health.
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setDialogOpen(true)}>
              Add Account
            </Button>
          )}
        </div>

        {/* Filters bar */}
        <div className="flex flex-col gap-3 rounded-[28px] border border-white/70 bg-white/72 p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name or domain…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={tierFilter}
            onValueChange={(v) => setTierFilter(v === "ALL" ? "" : (v as Tier))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All tiers</SelectItem>
              <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
              <SelectItem value="GROWTH">Growth</SelectItem>
              <SelectItem value="STARTER">Starter</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v === "ALL" ? "" : (v as HealthStatus))
            }
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="HEALTHY">Healthy</SelectItem>
              <SelectItem value="AT_RISK">At Risk</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="UNKNOWN">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          {isLoading ? (
            <TableSkeleton />
          ) : !accounts?.length ? (
            <CardContent className="p-0">
              <EmptyState
                hasFilters={hasFilters}
                onAddClick={() => setDialogOpen(true)}
                canAdd={canEdit}
              />
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur-sm">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-gray-100">
                      {headerGroup.headers.map((header) => {
                        const sortable = header.column.getCanSort();
                        const sorted = header.column.getIsSorted();
                        return (
                          <th
                            key={header.id}
                            className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 ${
                              sortable ? "cursor-pointer select-none hover:text-gray-700" : ""
                            }`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <div className="flex items-center gap-1">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {sortable &&
                                (sorted === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5" />
                                ) : sorted === "desc" ? (
                                  <ArrowDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
                                ))}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer transition-colors hover:bg-gray-50/60"
                      onClick={() => handleRowClick(row.original.id)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="whitespace-nowrap px-6 py-4">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Add account dialog */}
      <AddAccountDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </PageWrapper>
  );
}

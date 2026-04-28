"use client";

import { useCallback, useMemo, useState, Fragment } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HealthRing } from "@/components/ui/health-ring";
import { HealthStatusBadge, HealthTrendIndicator } from "@/components/ui/health-badge";
import { SourceBadge } from "@/components/ui/source-badge";
import { Pencil, Trash2, ChevronRight } from "lucide-react";
import { useDeleteKPI } from "@/lib/hooks/use-kpis";
import { useKpiFrameworkSettings } from "@/lib/hooks/use-kpi-framework";
import {
  dedupeSignalSources,
  deriveKpiClassification,
  getKpiTypeMeta,
  getKpiTypeRank,
  type DerivedKpiType,
} from "@/lib/kpi-insights";
import { AddKPIDialog } from "./add-kpi-dialog";
import { EditKPIDialog } from "./edit-kpi-dialog";
import { KpiEvidenceDrawer } from "./kpi-evidence-drawer";
import { KpiClassificationSheet } from "./kpi-classification-sheet";
import type { KPI } from "./account-overview";
import { cn } from "@/lib/utils";

const SIGNAL_SOURCES = new Set([
  "SLACK",
  "FATHOM",
  "AM_MEETING",
  "VITALLY",
  "SALESFORCE",
  "PERSONAS",
  "SHAREPOINT",
  "JIRA",
  "GOOGLE_DRIVE",
]);

const KPI_TYPE_OPTIONS: Array<DerivedKpiType | "ALL"> = [
  "ALL",
  "DOCUMENTED",
  "WORKING",
  "SUGGESTED",
  "MANUAL",
];

const HEALTH_FILTER_OPTIONS = [
  "ALL",
  "HEALTHY",
  "AT_RISK",
  "CRITICAL",
  "UNKNOWN",
] as const;

const HEALTH_SORT_ORDER: Record<string, number> = {
  CRITICAL: 0,
  AT_RISK: 1,
  UNKNOWN: 2,
  HEALTHY: 3,
};

const KPI_SORT_OPTIONS = [
  { value: "type", label: "KPI type" },
  { value: "metricName", label: "Metric name" },
  { value: "category", label: "Category" },
  { value: "healthStatus", label: "Health state" },
  { value: "healthScore", label: "Health score" },
  { value: "evidenceCount", label: "Evidence count" },
  { value: "lastScoredAt", label: "Last scored" },
] as const;

type KpiSortKey = (typeof KPI_SORT_OPTIONS)[number]["value"];

type KPIViewRow = KPI & {
  kpiType: DerivedKpiType;
  evidenceSources: string[];
  classificationReason: string;
};

interface KPITableProps {
  accountId: string;
  kpis: KPI[];
  canEdit: boolean;
  canViewEvidence?: boolean;
}

function formatCategoryLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function formatSentenceLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export function KPITable({
  accountId,
  kpis,
  canEdit,
  canViewEvidence = false,
}: KPITableProps) {
  const { data: frameworkSettings } = useKpiFrameworkSettings();
  const [addOpen, setAddOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);
  const [evidenceKpi, setEvidenceKpi] = useState<KPI | null>(null);
  const [classificationKpi, setClassificationKpi] = useState<KPIViewRow | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DerivedKpiType | "ALL">("ALL");
  const [healthFilter, setHealthFilter] =
    useState<(typeof HEALTH_FILTER_OPTIONS)[number]>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<KpiSortKey>("type");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const deleteKPI = useDeleteKPI(accountId);

  const handleDelete = useCallback(
    (kpiId: string, name: string) => {
      if (!confirm(`Delete KPI "${name}"? This action cannot be undone.`)) return;
      deleteKPI.mutate(kpiId);
    },
    [deleteKPI]
  );

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const rows = useMemo<KPIViewRow[]>(
    () =>
      kpis.map((kpi) => {
        const evidenceSources = dedupeSignalSources(
          kpi.evidence?.map((item) => item.signal.source) ?? []
        );
        const classification = deriveKpiClassification({
          source: kpi.source,
          targetValue: kpi.targetValue,
          currentValue: kpi.currentValue,
          evidenceSources,
          evidenceCount: kpi._count?.evidence ?? evidenceSources.length,
          overrideType: (kpi.classificationOverride as DerivedKpiType | null) ?? null,
          overrideNote: kpi.classificationNote,
          settings: frameworkSettings?.settings,
        });

        return {
          ...kpi,
          evidenceSources: classification.evidenceSources,
          kpiType: classification.type,
          classificationReason: classification.reason,
        };
      }),
    [frameworkSettings?.settings, kpis]
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.category).filter(Boolean))).sort(),
    [rows]
  );

  const sourceOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows.flatMap((row) =>
            row.evidenceSources.length > 0 ? row.evidenceSources : row.source ? [row.source] : []
          )
        )
      ).sort(),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows
      .filter((row) => {
        const matchesSearch =
          query.length === 0 ||
          [
            row.metricName,
            row.targetValue,
            row.currentValue,
            row.category,
            row.healthNarrative,
          ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(query));

        const matchesType = typeFilter === "ALL" || row.kpiType === typeFilter;
        const matchesHealth =
          healthFilter === "ALL" || row.healthStatus === healthFilter;
        const matchesCategory =
          categoryFilter === "ALL" || row.category === categoryFilter;
        const sourcePool =
          row.evidenceSources.length > 0 ? row.evidenceSources : row.source ? [row.source] : [];
        const matchesSource =
          sourceFilter === "ALL" || sourcePool.includes(sourceFilter);

        return (
          matchesSearch &&
          matchesType &&
          matchesHealth &&
          matchesCategory &&
          matchesSource
        );
      })
      .sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case "type":
            comparison = getKpiTypeRank(a.kpiType) - getKpiTypeRank(b.kpiType);
            break;
          case "metricName":
            comparison = a.metricName.localeCompare(b.metricName);
            break;
          case "category":
            comparison = formatCategoryLabel(a.category).localeCompare(
              formatCategoryLabel(b.category)
            );
            break;
          case "healthStatus":
            comparison =
              (HEALTH_SORT_ORDER[a.healthStatus ?? "UNKNOWN"] ?? 99) -
              (HEALTH_SORT_ORDER[b.healthStatus ?? "UNKNOWN"] ?? 99);
            break;
          case "healthScore":
            comparison = (a.healthScore ?? -1) - (b.healthScore ?? -1);
            break;
          case "evidenceCount":
            comparison =
              (a._count?.evidence ?? 0) - (b._count?.evidence ?? 0);
            break;
          case "lastScoredAt":
            comparison =
              new Date(a.lastScoredAt ?? 0).getTime() -
              new Date(b.lastScoredAt ?? 0).getTime();
            break;
        }

        if (comparison === 0) {
          comparison = a.metricName.localeCompare(b.metricName);
        }

        return sortOrder === "desc" ? -comparison : comparison;
      });
  }, [
    categoryFilter,
    healthFilter,
    rows,
    search,
    sortBy,
    sortOrder,
    sourceFilter,
    typeFilter,
  ]);

  const summaryCards = useMemo(
    () =>
      KPI_TYPE_OPTIONS.filter((type): type is DerivedKpiType => type !== "ALL").map((type) => {
        const meta = getKpiTypeMeta(type);
        return {
          type,
          ...meta,
          count: rows.filter((row) => row.kpiType === type).length,
        };
      }),
    [rows]
  );

  const columns = useMemo<ColumnDef<KPIViewRow, unknown>[]>(
    () => [
      {
        id: "expander",
        header: () => null,
        cell: ({ row }) => {
          const hasNarrative = !!row.original.healthNarrative;
          if (!hasNarrative) return null;
          return (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                toggleRow(row.original.id);
              }}
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform",
                  expandedRows[row.original.id] && "rotate-90"
                )}
              />
            </Button>
          );
        },
        size: 32,
      },
      {
        accessorKey: "metricName",
        header: "Metric",
        cell: ({ row }) => (
          <div className="min-w-[220px]">
            <p className="font-medium text-foreground">{row.original.metricName}</p>
            <p className="text-xs text-muted-foreground">
              {row.original._count?.evidence ?? 0} supporting signal
              {(row.original._count?.evidence ?? 0) === 1 ? "" : "s"}
            </p>
          </div>
        ),
      },
      {
        id: "kpiType",
        header: "KPI Type",
        cell: ({ row }) => {
          const meta = getKpiTypeMeta(row.original.kpiType);
          return (
            <Button
              type="button"
              variant="ghost"
              className="h-auto p-0 hover:bg-transparent"
              onClick={(event) => {
                event.stopPropagation();
                setClassificationKpi(row.original);
              }}
            >
              <Badge variant="outline" className={cn("text-xs", meta.className)}>
                {meta.label}
              </Badge>
            </Button>
          );
        },
        size: 120,
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatCategoryLabel(row.original.category)}
          </span>
        ),
        size: 120,
      },
      {
        accessorKey: "targetValue",
        header: "Target",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.targetValue
              ? `${row.original.targetValue}${row.original.unit ? ` ${row.original.unit}` : ""}`
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "currentValue",
        header: "Current",
        cell: ({ row }) => (
          <span className="font-semibold">
            {row.original.currentValue
              ? `${row.original.currentValue}${row.original.unit ? ` ${row.original.unit}` : ""}`
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "healthScore",
        header: "Health",
        cell: ({ row }) =>
          row.original.healthScore != null ? (
            <HealthRing score={row.original.healthScore} size={32} showLabel={false} />
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
        size: 56,
      },
      {
        accessorKey: "healthStatus",
        header: "Status",
        cell: ({ row }) =>
          row.original.healthStatus ? (
            <HealthStatusBadge
              status={
                row.original.healthStatus as
                  | "HEALTHY"
                  | "AT_RISK"
                  | "CRITICAL"
                  | "UNKNOWN"
              }
            />
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "healthTrend",
        header: "Trend",
        cell: ({ row }) =>
          row.original.healthTrend ? (
            <HealthTrendIndicator
              trend={
                row.original.healthTrend as
                  | "IMPROVING"
                  | "STABLE"
                  | "DECLINING"
              }
            />
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        id: "evidenceSources",
        header: "Evidence Sources",
        cell: ({ row }) => {
          const sources =
            row.original.evidenceSources.length > 0
              ? row.original.evidenceSources
              : row.original.source
                ? [row.original.source]
                : [];

          if (sources.length === 0) {
            return <span className="text-sm text-muted-foreground">—</span>;
          }

          return (
            <div className="flex max-w-[210px] flex-wrap gap-1">
              {sources.slice(0, 2).map((source) =>
                SIGNAL_SOURCES.has(source) ? (
                  <SourceBadge key={source} source={source as never} />
                ) : (
                  <Badge key={source} variant="secondary" className="text-xs">
                    {formatSentenceLabel(source)}
                  </Badge>
                )
              )}
              {sources.length > 2 ? (
                <Badge variant="outline" className="text-xs">
                  +{sources.length - 2}
                </Badge>
              ) : null}
            </div>
          );
        },
        size: 220,
      },
      {
        id: "evidence",
        header: "Evidence",
        cell: ({ row }) => {
          const count = row.original._count?.evidence ?? 0;
          if (canViewEvidence && count > 0) {
            return (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs font-normal"
                onClick={(e) => {
                  e.stopPropagation();
                  setEvidenceKpi(row.original);
                }}
              >
                {count} signal{count !== 1 ? "s" : ""}
              </Button>
            );
          }
          return (
            <Badge variant="outline" className="text-xs">
              {count} signal{count !== 1 ? "s" : ""}
            </Badge>
          );
        },
      },
      {
        id: "video",
        header: "Video",
        cell: ({ row }) =>
          row.original.videoClipUrl ? (
            <a
              href={row.original.videoClipUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-xs font-medium text-slate-700 hover:text-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              Open
            </a>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
        size: 72,
      },
      ...(canEdit
        ? [
            {
              id: "actions" as const,
              header: () => null,
              cell: ({ row }: { row: { original: KPIViewRow } }) => (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingKpi(row.original);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(row.original.id, row.original.metricName);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ),
              size: 80,
            } satisfies ColumnDef<KPIViewRow, unknown>,
          ]
        : []),
    ],
    [canEdit, canViewEvidence, expandedRows, handleDelete]
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  if (rows.length === 0 && !canEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No KPIs have been configured for this account yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {summaryCards.map((item) => (
          <Card
            key={item.type}
            className="rounded-2xl border-slate-200 px-4 py-3 shadow-none"
          >
            <div className="flex items-center justify-between gap-3">
              <Badge variant="outline" className={cn("text-xs", item.className)}>
                {item.label}
              </Badge>
              <span className="text-lg font-semibold text-foreground">
                {item.count}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-none">
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
            <div className="space-y-1.5 xl:col-span-2">
              <p className="text-xs font-medium text-slate-500">Search</p>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by metric or narrative"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-500">KPI type</p>
              <Select
                value={typeFilter}
                onValueChange={(value) =>
                  setTypeFilter(value as DerivedKpiType | "ALL")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All KPI types" />
                </SelectTrigger>
                <SelectContent>
                  {KPI_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === "ALL" ? "All KPI types" : getKpiTypeMeta(type).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-500">Category</p>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All categories</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {formatCategoryLabel(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-500">Health</p>
              <Select
                value={healthFilter}
                onValueChange={(value) =>
                  setHealthFilter(value as (typeof HEALTH_FILTER_OPTIONS)[number])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All health states" />
                </SelectTrigger>
                <SelectContent>
                  {HEALTH_FILTER_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === "ALL"
                        ? "All health states"
                        : formatSentenceLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 xl:col-span-2 2xl:col-span-1">
              <p className="text-xs font-medium text-slate-500">Evidence source</p>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All evidence sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All evidence sources</SelectItem>
                  {sourceOptions.map((source) => (
                    <SelectItem key={source} value={source}>
                      {formatSentenceLabel(source)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500">Sort by</p>
                <Select
                  value={sortBy}
                  onValueChange={(value) => setSortBy(value as KpiSortKey)}
                >
                  <SelectTrigger className="sm:w-[180px]">
                    <SelectValue placeholder="KPI type" />
                  </SelectTrigger>
                  <SelectContent>
                    {KPI_SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500">Order</p>
                <Select
                  value={sortOrder}
                  onValueChange={(value) =>
                    setSortOrder(value as "asc" | "desc")
                  }
                >
                  <SelectTrigger className="sm:w-[160px]">
                    <SelectValue placeholder="Ascending" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-3 text-slate-500 hover:text-slate-900"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("ALL");
                  setHealthFilter("ALL");
                  setCategoryFilter("ALL");
                  setSourceFilter("ALL");
                  setSortBy("type");
                  setSortOrder("asc");
                }}
              >
                Reset
              </Button>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                  Add KPI
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          Showing {filteredRows.length} of {rows.length} KPI
          {rows.length === 1 ? "" : "s"}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No KPIs yet. Add your first KPI to start tracking.
          </p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            No KPIs match the current filters.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a broader KPI type, health state, or evidence source.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-none">
          <div className="overflow-x-auto">
            <Table className="min-w-[1180px]">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="sticky top-0 z-10 bg-slate-50/95 text-[11px] font-medium text-slate-500 backdrop-blur"
                        style={
                          header.column.getSize() !== 150
                            ? { width: header.column.getSize() }
                            : undefined
                        }
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <Fragment key={row.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => {
                        if (row.original.healthNarrative) toggleRow(row.original.id);
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {expandedRows[row.original.id] &&
                      row.original.healthNarrative && (
                        <TableRow className="bg-slate-50/50">
                          <TableCell colSpan={columns.length} className="py-3">
                            <div className="space-y-2 pl-10">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Health narrative
                                </p>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    getKpiTypeMeta(row.original.kpiType).className
                                  )}
                                >
                                  {getKpiTypeMeta(row.original.kpiType).label}
                                </Badge>
                              </div>
                              <p className="text-sm leading-relaxed text-foreground">
                                {row.original.healthNarrative}
                              </p>
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                {row.original.classificationReason}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <AddKPIDialog
        accountId={accountId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      {editingKpi && (
        <EditKPIDialog
          accountId={accountId}
          kpi={editingKpi}
          open={!!editingKpi}
          onOpenChange={(open) => {
            if (!open) setEditingKpi(null);
          }}
        />
      )}

      <KpiEvidenceDrawer
        accountId={accountId}
        kpiId={evidenceKpi?.id ?? null}
        metricName={evidenceKpi?.metricName ?? null}
        open={!!evidenceKpi}
        onOpenChange={(open) => {
          if (!open) setEvidenceKpi(null);
        }}
      />

      <KpiClassificationSheet
        accountId={accountId}
        kpi={classificationKpi}
        derivedType={classificationKpi?.kpiType ?? null}
        reason={classificationKpi?.classificationReason ?? null}
        evidenceSources={classificationKpi?.evidenceSources ?? []}
        canOverride={canEdit}
        open={!!classificationKpi}
        onOpenChange={(open) => {
          if (!open) setClassificationKpi(null);
        }}
      />
    </div>
  );
}

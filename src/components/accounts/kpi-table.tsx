"use client";

import { useState, useMemo, Fragment } from "react";
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
import { HealthRing } from "@/components/ui/health-ring";
import { HealthStatusBadge } from "@/components/ui/health-badge";
import { HealthTrendIndicator } from "@/components/ui/health-badge";
import { SourceBadge } from "@/components/ui/source-badge";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  FileText,
  PlayCircle,
} from "lucide-react";
import { useDeleteKPI } from "@/lib/hooks/use-kpis";
import { AddKPIDialog } from "./add-kpi-dialog";
import { EditKPIDialog } from "./edit-kpi-dialog";
import { KpiEvidenceDrawer } from "./kpi-evidence-drawer";
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

interface KPITableProps {
  accountId: string;
  kpis: KPI[];
  canEdit: boolean;
  canViewEvidence?: boolean;
}

export function KPITable({
  accountId,
  kpis,
  canEdit,
  canViewEvidence = false,
}: KPITableProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);
  const [evidenceKpi, setEvidenceKpi] = useState<KPI | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const deleteKPI = useDeleteKPI(accountId);

  const handleDelete = (kpiId: string, name: string) => {
    if (!confirm(`Delete KPI "${name}"? This action cannot be undone.`)) return;
    deleteKPI.mutate(kpiId);
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const columns = useMemo<ColumnDef<KPI, unknown>[]>(
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
        header: "Metric Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.metricName}</span>
        ),
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
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => {
          const src = row.original.source;
          if (!src) return <span className="text-sm text-muted-foreground">—</span>;
          if (SIGNAL_SOURCES.has(src)) {
            return <SourceBadge source={src as never} />;
          }
          return (
            <Badge variant="secondary" className="text-xs">
              {src.replace(/_/g, " ")}
            </Badge>
          );
        },
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
                className="h-7 gap-1 px-2 text-xs font-normal"
                onClick={(e) => {
                  e.stopPropagation();
                  setEvidenceKpi(row.original);
                }}
              >
                <FileText className="h-3 w-3" />
                {count} signal{count !== 1 ? "s" : ""}
              </Button>
            );
          }
          return (
            <Badge variant="outline" className="gap-1 text-xs">
              <FileText className="h-3 w-3" />
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
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              onClick={(e) => e.stopPropagation()}
            >
              <PlayCircle className="h-3.5 w-3.5" />
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
              cell: ({ row }: { row: { original: KPI } }) => (
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
            } satisfies ColumnDef<KPI, unknown>,
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, canViewEvidence, expandedRows]
  );

  const table = useReactTable({
    data: kpis,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  if (kpis.length === 0 && !canEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No KPIs have been configured for this account yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add KPI
          </Button>
        </div>
      )}

      {kpis.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No KPIs yet. Add your first KPI to start tracking.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden rounded-2xl border-gray-100 shadow-sm">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/30">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="sticky top-0 bg-muted/30"
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
                    className="cursor-pointer hover:bg-muted/50"
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
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={columns.length} className="py-3">
                          <div className="pl-10">
                            <p className="mb-1 text-xs font-medium text-muted-foreground">
                              AI Health Narrative
                            </p>
                            <p className="text-sm leading-relaxed text-foreground">
                              {row.original.healthNarrative}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
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
    </div>
  );
}

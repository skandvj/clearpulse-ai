"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SourceBadge } from "@/components/ui/source-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "SLACK", label: "Slack" },
  { value: "FATHOM", label: "Fathom" },
  { value: "AM_MEETING", label: "AM Meeting" },
  { value: "VITALLY", label: "Vitally" },
  { value: "SALESFORCE", label: "Salesforce" },
  { value: "PERSONAS", label: "Personas" },
  { value: "SHAREPOINT", label: "SharePoint" },
  { value: "JIRA", label: "Jira" },
  { value: "GOOGLE_DRIVE", label: "Google Drive" },
] as const;

export type EvidenceSignal = {
  id: string;
  source: string;
  title: string | null;
  author: string | null;
  url: string | null;
  signalDate: string;
  contentPreview: string;
};

export type EvidenceRow = {
  id: string;
  excerpt: string;
  relevance: number;
  isHighPriority: boolean;
  signal: EvidenceSignal;
};

interface KpiEvidenceDrawerProps {
  accountId: string;
  kpiId: string | null;
  metricName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function fetchEvidence(
  accountId: string,
  kpiId: string,
  source: string,
  dateFrom: string,
  dateTo: string
): Promise<{ metricName: string; evidence: EvidenceRow[] }> {
  const qs = new URLSearchParams();
  if (source !== "all") qs.set("source", source);
  if (dateFrom) qs.set("dateFrom", dateFrom);
  if (dateTo) qs.set("dateTo", dateTo);
  const q = qs.toString();
  const url = `/api/accounts/${accountId}/kpis/${kpiId}/evidence${q ? `?${q}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to load evidence");
  }
  return res.json();
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function KpiEvidenceDrawer({
  accountId,
  kpiId,
  metricName,
  open,
  onOpenChange,
}: KpiEvidenceDrawerProps) {
  const [source, setSource] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["kpi-evidence", accountId, kpiId, source, dateFrom, dateTo],
    queryFn: () =>
      fetchEvidence(accountId, kpiId!, source, dateFrom, dateTo),
    enabled: open && !!kpiId,
  });

  const grouped = useMemo(() => {
    const list = data?.evidence ?? [];
    const map = new Map<string, EvidenceRow[]>();
    for (const row of list) {
      const key = row.signal.source;
      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data?.evidence]);

  const titleMetric = data?.metricName ?? metricName ?? "KPI";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-l border-gray-100 p-0 sm:max-w-lg"
      >
        <SheetHeader className="space-y-1 border-b border-gray-100 px-6 py-4 text-left">
          <SheetTitle className="font-display text-lg">Signal evidence</SheetTitle>
          <SheetDescription className="line-clamp-2">
            Supporting signals for{" "}
            <span className="font-medium text-foreground">{titleMetric}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 border-b border-gray-100 px-6 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Date range</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  className="h-9 flex-1 min-w-[8rem]"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  className="h-9 flex-1 min-w-[8rem]"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 px-6 py-4">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading evidence…
            </div>
          )}

          {error && !isLoading && (
            <p className="py-8 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : "Something went wrong"}
            </p>
          )}

          {!isLoading && !error && grouped.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No evidence matches these filters.
            </p>
          )}

          {!isLoading &&
            !error &&
            grouped.map(([src, rows]) => (
              <div key={src} className="mb-6 last:mb-0">
                <div className="mb-2 flex items-center gap-2">
                  <SourceBadge source={src as never} />
                  <span className="text-xs text-muted-foreground">
                    {rows.length} signal{rows.length !== 1 ? "s" : ""}
                  </span>
                  {isFetching && !isLoading && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </div>
                <ul className="space-y-3">
                  {rows.map((row) => (
                    <li
                      key={row.id}
                      className={cn(
                        "rounded-xl border border-gray-100 bg-card p-3 shadow-sm",
                        row.isHighPriority && "border-amber-200/80 bg-amber-50/40"
                      )}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {row.isHighPriority && (
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-amber-900 hover:bg-amber-100"
                          >
                            High priority
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatShortDate(row.signal.signalDate)}
                        </span>
                        {row.signal.author && (
                          <span className="text-xs font-medium text-foreground">
                            {row.signal.author}
                          </span>
                        )}
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                          {(row.relevance * 100).toFixed(0)}% match
                        </span>
                      </div>
                      {row.signal.title && (
                        <p className="mb-1 text-sm font-medium leading-snug">
                          {row.signal.title}
                        </p>
                      )}
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Excerpt:{" "}
                        </span>
                        {row.excerpt}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground/90">
                        {row.signal.contentPreview}
                      </p>
                      {row.signal.url && (
                        <Button
                          variant="link"
                          size="sm"
                          className="mt-1 h-auto p-0 text-xs"
                          asChild
                        >
                          <a
                            href={row.signal.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1"
                          >
                            Open original
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

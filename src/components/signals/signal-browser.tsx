"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  X,
  Link2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceBadge, getSourceConfig } from "@/components/ui/source-badge";
import type { SignalSource } from "@/components/ui/source-badge";
import { SyncTriggerButton } from "@/components/signals/sync-trigger-button";
import { useSignals, type SignalFilters } from "@/lib/hooks/use-signals";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const ALL_SOURCES: SignalSource[] = [
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

interface SignalBrowserProps {
  accountId: string;
}

export function SignalBrowser({ accountId }: SignalBrowserProps) {
  const { can } = usePermissions();

  const [activeSources, setActiveSources] = useState<Set<SignalSource>>(
    new Set()
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [author, setAuthor] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, []);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const filters: SignalFilters = {
    source: activeSources.size > 0 ? Array.from(activeSources).join(",") : undefined,
    search: debouncedSearch || undefined,
    author: author || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 25,
  };

  const { data, isLoading } = useSignals(accountId, filters);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  const toggleSource = (source: SignalSource) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
    setPage(1);
  };

  const clearFilters = () => {
    setActiveSources(new Set());
    setSearch("");
    setDebouncedSearch("");
    setAuthor("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasActiveFilters =
    activeSources.size > 0 || debouncedSearch || author || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Signal Browser</h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-1">
              {data.total} signal{data.total !== 1 ? "s" : ""} found
            </p>
          )}
        </div>
        {can(PERMISSIONS.TRIGGER_SOURCE_SYNC) && (
          <SyncTriggerButton accountId={accountId} />
        )}
      </div>

      {/* Filter Bar */}
      <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        {/* Source Toggles */}
        <div className="flex flex-wrap gap-2">
          {ALL_SOURCES.map((source) => {
            const config = getSourceConfig(source);
            const active = activeSources.has(source);
            return (
              <button
                key={source}
                onClick={() => toggleSource(source)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  active
                    ? `${config.bgColor} ${config.color} ${config.borderColor}`
                    : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                )}
              >
                {config.label}
              </button>
            );
          })}
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search signals…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Input
            placeholder="Filter by author"
            value={author}
            onChange={(e) => {
              setAuthor(e.target.value);
              setPage(1);
            }}
          />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            placeholder="From date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            placeholder="To date"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            Clear all filters
          </button>
        )}
      </div>

      {/* Signal List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <Skeleton className="h-6 w-20 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : !data || data.signals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-16 px-6 text-center">
          <Search className="h-10 w-10 text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">
            No signals found.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
            Trigger a sync to pull data from connected sources.
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`page-${page}-${debouncedSearch}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {data.signals.map((signal) => {
              const isExpanded = expandedId === signal.id;
              const contentPreview =
                signal.content.length > 200
                  ? signal.content.slice(0, 200) + "…"
                  : signal.content;

              return (
                <button
                  key={signal.id}
                  onClick={() =>
                    setExpandedId(isExpanded ? null : signal.id)
                  }
                  className="w-full text-left rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    {/* Left: Source + processed indicator */}
                    <div className="flex flex-col items-center gap-2 pt-0.5">
                      <SourceBadge source={signal.source} size="sm" />
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          signal.processed
                            ? "bg-emerald-500"
                            : "bg-gray-300"
                        )}
                        title={
                          signal.processed ? "Processed" : "Not processed"
                        }
                      />
                    </div>

                    {/* Center: Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {signal.title || "Untitled Signal"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(signal.signalDate).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </span>
                      </div>

                      {signal.author && (
                        <p className="text-xs text-muted-foreground">
                          {signal.author}
                        </p>
                      )}

                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {isExpanded ? signal.content : contentPreview}
                      </p>

                      {/* Meta badges */}
                      <div className="flex items-center gap-2 pt-1">
                        {signal._count.kpiEvidence > 0 && (
                          <Badge
                            variant="secondary"
                            className="text-xs gap-1"
                          >
                            <Link2 className="h-3 w-3" />
                            {signal._count.kpiEvidence} KPI
                            {signal._count.kpiEvidence !== 1 ? "s" : ""}{" "}
                            linked
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Right: External link */}
                    {signal.url && (
                      <a
                        href={signal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-gray-100 hover:text-foreground transition-colors"
                        title="Open original"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

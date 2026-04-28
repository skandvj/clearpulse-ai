"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SourceBadge } from "@/components/ui/source-badge";
import { useUpdateKPI } from "@/lib/hooks/use-kpis";
import { getKpiTypeMeta, type DerivedKpiType } from "@/lib/kpi-insights";
import { cn } from "@/lib/utils";

type ClassificationKpi = {
  id: string;
  metricName: string;
  source: string | null;
  targetValue: string | null;
  currentValue: string | null;
  classificationOverride: string | null;
  classificationNote: string | null;
};

interface KpiClassificationSheetProps {
  accountId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpi: ClassificationKpi | null;
  derivedType: DerivedKpiType | null;
  reason: string | null;
  evidenceSources: string[];
  canOverride: boolean;
}

const OVERRIDE_OPTIONS: Array<{ label: string; value: "AUTO" | DerivedKpiType }> = [
  { label: "Auto", value: "AUTO" },
  { label: "Documented", value: "DOCUMENTED" },
  { label: "Working", value: "WORKING" },
  { label: "Suggested", value: "SUGGESTED" },
  { label: "Manual", value: "MANUAL" },
];

export function KpiClassificationSheet({
  accountId,
  open,
  onOpenChange,
  kpi,
  derivedType,
  reason,
  evidenceSources,
  canOverride,
}: KpiClassificationSheetProps) {
  const updateKpi = useUpdateKPI(accountId, kpi?.id ?? "");
  const [overrideValue, setOverrideValue] = useState<"AUTO" | DerivedKpiType>("AUTO");
  const [classificationNote, setClassificationNote] = useState("");

  useEffect(() => {
    if (!kpi) {
      setOverrideValue("AUTO");
      setClassificationNote("");
      return;
    }

    setOverrideValue((kpi.classificationOverride as DerivedKpiType | null) ?? "AUTO");
    setClassificationNote(kpi.classificationNote ?? "");
  }, [kpi]);

  const activeType = derivedType ? getKpiTypeMeta(derivedType) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[520px] overflow-y-auto p-0">
        <SheetHeader className="space-y-1 border-b border-slate-200 px-6 py-5 text-left">
          <SheetTitle className="font-display text-lg">KPI classification</SheetTitle>
          <SheetDescription className="line-clamp-2">
            {kpi?.metricName ?? "KPI"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Current classification</p>
                <p className="mt-1 text-sm text-slate-500">
                  This is the framework output currently used in the account view.
                </p>
              </div>
              {activeType ? (
                <Badge variant="outline" className={cn("text-xs", activeType.className)}>
                  {activeType.label}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-900">Why it landed here</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {reason ?? "No classification reason available."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-900">Evidence sources</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {evidenceSources.length > 0 ? (
                evidenceSources.map((source) => (
                  <SourceBadge key={source} source={source as never} />
                ))
              ) : (
                <p className="text-sm text-slate-500">No supporting evidence sources recorded yet.</p>
              )}
            </div>
          </div>

          {canOverride ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">Override classification</p>
                <p className="text-sm leading-relaxed text-slate-500">
                  Use this when the team wants to correct the current classification
                  without waiting for prompt or rule changes.
                </p>
              </div>

              <div className="mt-4 space-y-4">
                <Select
                  value={overrideValue}
                  onValueChange={(value) => setOverrideValue(value as "AUTO" | DerivedKpiType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose classification" />
                  </SelectTrigger>
                  <SelectContent>
                    {OVERRIDE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Textarea
                  value={classificationNote}
                  onChange={(event) => setClassificationNote(event.target.value)}
                  placeholder="Optional note explaining why the team changed this classification"
                  className="min-h-[120px]"
                />

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setOverrideValue("AUTO");
                      setClassificationNote("");
                    }}
                  >
                    Reset draft
                  </Button>
                  <Button
                    type="button"
                    disabled={!kpi || updateKpi.isPending}
                    onClick={() =>
                      kpi &&
                      updateKpi.mutate({
                        classificationOverride:
                          overrideValue === "AUTO" ? null : overrideValue,
                        classificationNote:
                          classificationNote.trim().length > 0
                            ? classificationNote.trim()
                            : null,
                      })
                    }
                  >
                    Save classification
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

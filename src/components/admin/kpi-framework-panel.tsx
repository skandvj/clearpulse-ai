"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAdminKpiFramework,
  useUpdateKpiFramework,
  type KpiFrameworkFieldState,
  type KpiFrameworkReferenceRow,
} from "@/lib/hooks/use-kpi-framework";

function CompactTable({
  rows,
  columns,
}: {
  rows: KpiFrameworkReferenceRow[];
  columns: string[];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                {column.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, index) => (
            <tr key={`${row[columns[0]] ?? "row"}-${index}`}>
              {columns.map((column) => (
                <td
                  key={column}
                  className="max-w-[320px] px-4 py-3 align-top text-slate-700"
                >
                  {row[column] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FrameworkField({
  field,
  value,
  onChange,
}: {
  field: KpiFrameworkFieldState;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-900">{field.label}</p>
        <p className="text-sm leading-relaxed text-slate-500">
          {field.description}
        </p>
      </div>

      <div className="mt-4">
        {field.inputType === "switch" ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-600">
              {value ? "Enabled" : "Disabled"}
            </span>
            <Switch checked={Boolean(value)} onCheckedChange={onChange} />
          </div>
        ) : null}

        {field.inputType === "number" ? (
          <Input
            type="number"
            min={field.min}
            max={field.max}
            value={String(value)}
            onChange={(event) => onChange(Number(event.target.value))}
            className="max-w-[160px]"
          />
        ) : null}

        {field.inputType === "select" ? (
          <Select value={String(value)} onValueChange={onChange}>
            <SelectTrigger className="max-w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </div>
  );
}

export function AdminKpiFrameworkPanel() {
  const { data, isLoading, error } = useAdminKpiFramework();
  const updateFramework = useUpdateKpiFramework();
  const [draftValues, setDraftValues] = useState<Record<string, string | number | boolean>>(
    {}
  );

  useEffect(() => {
    if (!data?.settings.fields) return;

    setDraftValues(
      Object.fromEntries(
        data.settings.fields.map((field) => [field.key, field.value])
      )
    );
  }, [data]);

  const hasChanges = useMemo(() => {
    if (!data?.settings.fields) return false;

    return data.settings.fields.some((field) => draftValues[field.key] !== field.value);
  }, [data, draftValues]);

  if (isLoading) {
    return (
      <Card className="rounded-3xl border-slate-200 p-6">
        <p className="text-sm text-slate-500">Loading KPI framework…</p>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="rounded-3xl border-slate-200 p-6">
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : "Failed to load KPI framework."}
        </p>
      </Card>
    );
  }

  const policyColumns = [
    "rule_id",
    "condition_description",
    "should_promote_to_kpi",
    "kpi_type",
    "manual_review_required",
    "reason",
  ];
  const sourceColumns = [
    "source_name",
    "good_for_committed_kpis",
    "good_for_working_kpis",
    "good_for_health_signals",
    "recommended_initial_use",
  ];
  const exampleColumns = [
    "source",
    "example_text",
    "should_promote_to_kpi",
    "kpi_type",
    "final_classification",
  ];
  const fathomColumns = [
    "item_type",
    "extract_by_default",
    "used_for_health_scoring",
    "default_promotion_behavior",
    "manual_review_required",
    "notes",
  ];

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border-slate-200 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Master KPI framework
            </h2>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-500">
              One policy layer across all sources. Fathom starts the workflow, but the
              classification model stays shared across Slack, Vitally, Salesforce,
              Jira, and documents.
            </p>
          </div>
          <Button
            size="sm"
            disabled={!hasChanges || updateFramework.isPending}
            onClick={() => updateFramework.mutate(draftValues)}
          >
            Save framework settings
          </Button>
        </div>
      </Card>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-slate-100 p-1">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {data.settings.fields.map((field) => (
              <FrameworkField
                key={field.key}
                field={field}
                value={draftValues[field.key] ?? field.value}
                onChange={(value) =>
                  setDraftValues((current) => ({ ...current, [field.key]: value }))
                }
              />
            ))}
          </div>

          <Card className="rounded-3xl border-slate-200 p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900">How to use this</p>
              <p className="text-sm leading-relaxed text-slate-500">
                These settings control how discussion-heavy evidence is promoted into
                KPI rows. They do not replace the master rule matrix; they tune the
                ambiguity thresholds the product uses in production.
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <CompactTable rows={data.referenceData.policyMatrix} columns={policyColumns} />
          <Card className="rounded-3xl border-slate-200 p-6">
            <p className="text-sm leading-relaxed text-slate-500">
              This is the canonical policy matrix. If a KPI feels wrong, the first
              question should be whether the evidence belongs in a KPI, blocker,
              milestone, or context bucket.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <CompactTable rows={data.referenceData.sourceCoverage} columns={sourceColumns} />
          <CompactTable rows={data.referenceData.fathomProfile} columns={fathomColumns} />
        </TabsContent>

        <TabsContent value="examples" className="space-y-4">
          <CompactTable rows={data.referenceData.examples} columns={exampleColumns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

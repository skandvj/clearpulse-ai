"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useAISettings,
  useIntegrationStatuses,
  useTestIntegration,
  useUpdateAISettings,
  useUpdateIntegration,
  type AIFieldState,
  type IntegrationStatusCard,
} from "@/lib/hooks/use-integrations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SourceBadge, type SignalSource } from "@/components/ui/source-badge";

type FieldLike = {
  key: string;
  label: string;
  secret: boolean;
  configured: boolean;
  source: "database" | "environment" | "default" | "missing";
  value: string | null;
  valuePreview: string | null;
  helperText?: string;
  placeholder?: string;
  inputType?: "text" | "password" | "url" | "email" | "select";
  options?: Array<{
    label: string;
    value: string;
  }>;
};

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusBadge({
  status,
}: {
  status: "CONNECTED" | "PARTIAL" | "DISCONNECTED" | "ERROR";
}) {
  const styles: Record<typeof status, string> = {
    CONNECTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    PARTIAL: "border-amber-200 bg-amber-50 text-amber-700",
    DISCONNECTED: "border-slate-200 bg-slate-50 text-slate-600",
    ERROR: "border-red-200 bg-red-50 text-red-700",
  };

  const labels: Record<typeof status, string> = {
    CONNECTED: "Connected",
    PARTIAL: "Partial",
    DISCONNECTED: "Disconnected",
    ERROR: "Error",
  };

  return (
    <Badge variant="outline" className={styles[status]}>
      {labels[status]}
    </Badge>
  );
}

function fieldSourceLabel(field: FieldLike): string {
  if (field.source === "database") return "Saved";
  if (field.source === "environment") return "Environment";
  if (field.source === "default") return "Default";
  return "Missing";
}

function inputTypeForField(field: FieldLike): string {
  if (field.inputType === "password" || field.secret) return "password";
  if (field.inputType === "url") return "url";
  if (field.inputType === "email") return "email";
  return "text";
}

function fieldPlaceholder(field: FieldLike): string {
  if (field.secret) {
    if (field.configured) {
      return `Configured (${field.valuePreview ?? "hidden"})`;
    }

    return field.placeholder ?? "Enter securely";
  }

  return field.placeholder ?? "";
}

function FieldEditor({
  field,
  value,
  onChange,
  idPrefix,
}: {
  field: FieldLike;
  value: string;
  onChange: (nextValue: string) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`${idPrefix}-${field.key}`}>{field.label}</Label>
        <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
          {fieldSourceLabel(field)}
        </span>
      </div>
      {field.inputType === "select" && field.options ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={`${idPrefix}-${field.key}`}>
            <SelectValue placeholder={field.placeholder ?? "Select"} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={`${idPrefix}-${field.key}`}
          type={inputTypeForField(field)}
          value={value}
          placeholder={fieldPlaceholder(field)}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function AISettingsCard() {
  const aiSettingsQuery = useAISettings();
  const updateAISettings = useUpdateAISettings();
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const fields = aiSettingsQuery.data?.settings.fields ?? [];
    setDraftValues(
      Object.fromEntries(fields.map((field) => [field.key, field.value ?? ""]))
    );
  }, [aiSettingsQuery.data]);

  if (aiSettingsQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-slate-500">
          Loading AI settings…
        </CardContent>
      </Card>
    );
  }

  if (aiSettingsQuery.error || !aiSettingsQuery.data) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-red-600">
          {aiSettingsQuery.error?.message ?? "Failed to load AI settings"}
        </CardContent>
      </Card>
    );
  }

  const { fields, configuredCount, requiredCount } = aiSettingsQuery.data.settings;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const payload = Object.fromEntries(
        Object.entries(draftValues).map(([key, value]) => [key, value.trim()])
      ) as Partial<Record<AIFieldState["key"], string>>;

      const result = await updateAISettings.mutateAsync({ values: payload });
      toast.success(result.message);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save AI settings"
      );
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-2 pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-lg">AI providers</CardTitle>
          <p className="text-sm text-slate-600">
            {configuredCount}/{requiredCount} configured
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <div
                key={field.key}
                className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4"
              >
                <p className="text-sm font-medium text-slate-900">
                  {field.provider}
                </p>
                <div className="mt-4">
                  <FieldEditor
                    field={field}
                    value={draftValues[field.key] ?? ""}
                    onChange={(nextValue) =>
                      setDraftValues((current) => ({
                        ...current,
                        [field.key]: nextValue,
                      }))
                    }
                    idPrefix="ai-settings"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500">Encrypted server-side.</p>
            <Button type="submit" disabled={updateAISettings.isPending}>
              {updateAISettings.isPending ? "Saving…" : "Save AI settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function IntegrationCard({
  integration,
  onTest,
  onSave,
  testing,
  saving,
}: {
  integration: IntegrationStatusCard;
  onTest: (source: SignalSource) => Promise<void>;
  onSave: (source: SignalSource, values: Record<string, string>) => Promise<void>;
  testing: boolean;
  saving: boolean;
}) {
  const editableFields = useMemo(
    () => integration.fields.filter((field) => field.browserEditable),
    [integration.fields]
  );
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraftValues(
      Object.fromEntries(
        editableFields.map((field) => [field.key, field.secret ? "" : field.value ?? ""])
      )
    );
  }, [editableFields]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave(integration.source, draftValues);
  };

  const setupLine = `${integration.configuredCount}/${integration.requiredCount} configured`;
  const syncLine = `${integration.signalsStored} signals · last sync ${formatDateTime(
    integration.lastSyncedAt
  )}`;

  return (
    <Card>
      <CardHeader className="space-y-3 pb-4">
        <div className="flex items-center justify-between gap-3">
          <SourceBadge source={integration.source} />
          <StatusBadge status={integration.status} />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base">{integration.authType}</CardTitle>
          <p className="text-sm text-slate-600">
            {setupLine} · {syncLine}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {integration.lastJobError ? (
          <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {integration.lastJobError}
          </div>
        ) : null}

        {!integration.browserConfigurable ? (
          <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {integration.missingEnv.length > 0
              ? `This source still needs environment or OAuth setup: ${integration.missingEnv.join(", ")}`
              : "This source is configured outside the browser today."}
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {editableFields.map((field) => (
              <FieldEditor
                key={field.key}
                field={field}
                value={draftValues[field.key] ?? ""}
                onChange={(nextValue) =>
                  setDraftValues((current) => ({
                    ...current,
                    [field.key]: nextValue,
                  }))
                }
                idPrefix={integration.source}
              />
            ))}

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-500">
                Browser-managed values are encrypted before storage.
              </p>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <div className="text-xs text-slate-500">
            {integration.lastJobStatus
              ? `Last job: ${integration.lastJobStatus.toLowerCase()}`
              : "No sync job recorded yet"}
          </div>
          <Button
            variant="outline"
            onClick={() => onTest(integration.source)}
            disabled={testing}
          >
            {testing ? "Testing…" : "Test connection"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegrationsOverview() {
  const integrationsQuery = useIntegrationStatuses();
  const testIntegration = useTestIntegration();
  const updateIntegration = useUpdateIntegration();
  const [testingSource, setTestingSource] = useState<SignalSource | null>(null);
  const [savingSource, setSavingSource] = useState<SignalSource | null>(null);

  const handleTest = async (source: SignalSource) => {
    try {
      setTestingSource(source);
      const result = await testIntegration.mutateAsync(source);

      if (result.ok) {
        toast.success(`${source} is ready.`);
      } else {
        toast.warning(`${source}: ${result.message}`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to test integration"
      );
    } finally {
      setTestingSource(null);
    }
  };

  const handleSave = async (
    source: SignalSource,
    values: Record<string, string>
  ) => {
    try {
      setSavingSource(source);
      const result = await updateIntegration.mutateAsync({ source, values });
      toast.success(result.message);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save integration"
      );
    } finally {
      setSavingSource(null);
    }
  };

  if (integrationsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500">
        Loading integrations…
      </div>
    );
  }

  if (integrationsQuery.error || !integrationsQuery.data) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500">
        {integrationsQuery.error?.message ?? "Failed to load integrations"}
      </div>
    );
  }

  const { integrations, summary } = integrationsQuery.data;
  const needsSetup = summary.partial + summary.disconnected;

  return (
    <div className="space-y-5">
      <div className="text-sm text-slate-600">
        {summary.connected} connected · {needsSetup} need setup ·{" "}
        {summary.error} errors
      </div>

      <AISettingsCard />

      <div className="grid gap-4 lg:grid-cols-2">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.source}
            integration={integration}
            onTest={handleTest}
            onSave={handleSave}
            testing={testingSource === integration.source}
            saving={savingSource === integration.source}
          />
        ))}
      </div>
    </div>
  );
}

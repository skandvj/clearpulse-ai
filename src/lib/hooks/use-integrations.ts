import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SignalSource } from "@/components/ui/source-badge";

export type IntegrationStatus =
  | "CONNECTED"
  | "PARTIAL"
  | "DISCONNECTED"
  | "ERROR";

export type IntegrationFieldInputType =
  | "text"
  | "password"
  | "url"
  | "email";

export type IntegrationFieldValueSource =
  | "database"
  | "environment"
  | "missing";

export type AISettingKey = "ANTHROPIC_API_KEY" | "OPENAI_API_KEY";

export interface IntegrationFieldState {
  key: string;
  label: string;
  inputType: IntegrationFieldInputType;
  secret: boolean;
  browserEditable: boolean;
  helperText?: string;
  placeholder?: string;
  configured: boolean;
  source: IntegrationFieldValueSource;
  value: string | null;
  valuePreview: string | null;
}

export interface AIFieldState {
  key: AISettingKey;
  label: string;
  provider: "Anthropic" | "OpenAI";
  secret: boolean;
  browserEditable: boolean;
  helperText: string;
  placeholder?: string;
  configured: boolean;
  source: IntegrationFieldValueSource;
  value: string | null;
  valuePreview: string | null;
}

export interface IntegrationStatusCard {
  source: SignalSource;
  authType: "API Key" | "OAuth" | "Hybrid";
  description: string;
  requiredEnv: string[];
  browserConfigurable: boolean;
  fields: IntegrationFieldState[];
  missingEnv: string[];
  configuredCount: number;
  requiredCount: number;
  status: IntegrationStatus;
  lastJobStatus: string | null;
  lastSyncedAt: string | null;
  lastJobError: string | null;
  lastSignalsFound: number | null;
  signalsStored: number;
}

export interface IntegrationsResponse {
  integrations: IntegrationStatusCard[];
  summary: {
    connected: number;
    partial: number;
    disconnected: number;
    error: number;
    totalSignals: number;
  };
}

export interface IntegrationTestResponse {
  ok: boolean;
  source: SignalSource;
  status: IntegrationStatus;
  checkedAt: string;
  configuredCount: number;
  requiredCount: number;
  fields: IntegrationFieldState[];
  missingEnv: string[];
  message: string;
  lastJobStatus: string | null;
  lastSyncedAt: string | null;
  signalsStored: number;
}

export interface IntegrationUpdateResponse {
  message: string;
  integration: IntegrationStatusCard;
}

export interface AISettingsResponse {
  settings: {
    fields: AIFieldState[];
    configuredCount: number;
    requiredCount: number;
    missingKeys: AISettingKey[];
  };
}

export interface AISettingsUpdateResponse {
  message: string;
  settings: AISettingsResponse["settings"];
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function useIntegrationStatuses() {
  return useQuery<IntegrationsResponse>({
    queryKey: ["integration-statuses"],
    queryFn: () => fetchJSON<IntegrationsResponse>("/api/admin/integrations"),
  });
}

export function useAISettings() {
  return useQuery<AISettingsResponse>({
    queryKey: ["ai-settings"],
    queryFn: () => fetchJSON<AISettingsResponse>("/api/admin/ai-settings"),
  });
}

export function useTestIntegration() {
  const queryClient = useQueryClient();

  return useMutation<IntegrationTestResponse, Error, SignalSource>({
    mutationFn: (source) =>
      fetchJSON<IntegrationTestResponse>(`/api/admin/integrations/${source}/test`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-statuses"] });
    },
  });
}

export function useUpdateIntegration() {
  const queryClient = useQueryClient();

  return useMutation<
    IntegrationUpdateResponse,
    Error,
    { source: SignalSource; values: Record<string, string> }
  >({
    mutationFn: ({ source, values }) =>
      fetchJSON<IntegrationUpdateResponse>(`/api/admin/integrations/${source}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-statuses"] });
    },
  });
}

export function useUpdateAISettings() {
  const queryClient = useQueryClient();

  return useMutation<
    AISettingsUpdateResponse,
    Error,
    { values: Partial<Record<AISettingKey, string>> }
  >({
    mutationFn: ({ values }) =>
      fetchJSON<AISettingsUpdateResponse>("/api/admin/ai-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SignalSource } from "@/components/ui/source-badge";

export type IntegrationStatus =
  | "CONNECTED"
  | "PARTIAL"
  | "DISCONNECTED"
  | "ERROR";

export interface IntegrationStatusCard {
  source: SignalSource;
  authType: "API Key" | "OAuth" | "Hybrid";
  description: string;
  requiredEnv: string[];
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
  missingEnv: string[];
  message: string;
  lastJobStatus: string | null;
  lastSyncedAt: string | null;
  signalsStored: number;
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

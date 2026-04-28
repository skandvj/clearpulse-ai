import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return response.json();
}

export interface KpiFrameworkRuntimeSettings {
  workingKpiMinEvidenceCount: number;
  requireExplicitMetricForWorkingKpi: boolean;
  allowBlockerPromotion: boolean;
  fathomSingleSignalDefault: "suggested" | "working";
}

export interface KpiFrameworkFieldState {
  key:
    | "WORKING_KPI_MIN_EVIDENCE_COUNT"
    | "REQUIRE_EXPLICIT_METRIC_FOR_WORKING_KPI"
    | "ALLOW_BLOCKER_PROMOTION"
    | "FATHOM_SINGLE_SIGNAL_DEFAULT";
  label: string;
  description: string;
  inputType: "number" | "switch" | "select";
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string }>;
  value: number | boolean | string;
  defaultValue: number | boolean | string;
}

export interface KpiFrameworkReferenceRow {
  [key: string]: string;
}

export function useKpiFrameworkSettings() {
  return useQuery({
    queryKey: ["kpiFrameworkSettings"],
    queryFn: () =>
      fetchJson<{ settings: KpiFrameworkRuntimeSettings }>("/api/kpi-framework"),
    staleTime: 30_000,
  });
}

export function useAdminKpiFramework() {
  return useQuery({
    queryKey: ["adminKpiFramework"],
    queryFn: () =>
      fetchJson<{
        settings: { fields: KpiFrameworkFieldState[] };
        referenceData: {
          policyMatrix: KpiFrameworkReferenceRow[];
          sourceCoverage: KpiFrameworkReferenceRow[];
          examples: KpiFrameworkReferenceRow[];
          fathomProfile: KpiFrameworkReferenceRow[];
        };
      }>("/api/admin/kpi-framework"),
    staleTime: 30_000,
  });
}

export function useUpdateKpiFramework() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: Record<string, string | number | boolean>) =>
      fetchJson("/api/admin/kpi-framework", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminKpiFramework"] });
      queryClient.invalidateQueries({ queryKey: ["kpiFrameworkSettings"] });
      toast.success("KPI framework updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update KPI framework");
    },
  });
}

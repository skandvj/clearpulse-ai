import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function useCreateKPI(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetchJSON(`/api/accounts/${accountId}/kpis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts", accountId] });
      toast.success("KPI created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create KPI");
    },
  });
}

export function useUpdateKPI(accountId: string, kpiId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetchJSON(`/api/accounts/${accountId}/kpis/${kpiId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts", accountId] });
      toast.success("KPI updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update KPI");
    },
  });
}

export function useDeleteKPI(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (kpiId: string) =>
      fetchJSON(`/api/accounts/${accountId}/kpis/${kpiId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts", accountId] });
      toast.success("KPI deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete KPI");
    },
  });
}

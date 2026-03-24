import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { AccountTier } from "@/lib/accounts";

// ── Types ────────────────────────────────────────────────────────────────────

export type HealthStatus = "HEALTHY" | "AT_RISK" | "CRITICAL" | "UNKNOWN";
export type Tier = AccountTier;

export interface AccountCSM {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface Account {
  id: string;
  name: string;
  domain: string | null;
  tier: Tier | null;
  industry: string | null;
  healthScore: number | null;
  healthStatus: HealthStatus;
  csmId: string | null;
  csm: AccountCSM | null;
  lastSyncedAt: string | null;
  _count: {
    kpis: number;
    signals: number;
  };
}

export interface AccountFilters {
  search?: string;
  tier?: Tier | "";
  healthStatus?: HealthStatus | "";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CreateAccountPayload {
  name: string;
  domain?: string;
  tier?: Tier;
  industry?: string;
  csmId?: string;
}

export interface UpdateAccountPayload {
  name?: string;
  domain?: string;
  tier?: Tier | null;
  industry?: string;
  csmId?: string | null;
  currentSolution?: string;
  currentState?: string;
  businessGoals?: string;
  objectives?: string;
  roadblocks?: string;
  implementationPlan?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildQueryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] =>
      entry[1] !== undefined && entry[1] !== ""
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries).toString();
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useAccounts(filters: AccountFilters = {}) {
  return useQuery<Account[]>({
    queryKey: ["accounts", filters],
    queryFn: () =>
      fetchJSON<Account[]>(
        `/api/accounts${buildQueryString({
          search: filters.search,
          tier: filters.tier || undefined,
          healthStatus: filters.healthStatus || undefined,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        })}`
      ),
  });
}

export function useAccount<T = Account>(id: string) {
  return useQuery<T>({
    queryKey: ["accounts", id],
    queryFn: () => fetchJSON<T>(`/api/accounts/${id}`),
    enabled: !!id,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation<Account, Error, CreateAccountPayload>({
    mutationFn: (payload) =>
      fetchJSON<Account>("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useUpdateAccount(id: string) {
  const queryClient = useQueryClient();
  return useMutation<Account, Error, UpdateAccountPayload>({
    mutationFn: (payload) =>
      fetchJSON<Account>(`/api/accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

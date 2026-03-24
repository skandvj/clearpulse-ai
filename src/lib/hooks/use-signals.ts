import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

type SignalSource =
  | "SLACK"
  | "FATHOM"
  | "AM_MEETING"
  | "VITALLY"
  | "SALESFORCE"
  | "PERSONAS"
  | "SHAREPOINT"
  | "JIRA"
  | "GOOGLE_DRIVE";

type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface RawSignalResult {
  id: string;
  accountId: string;
  source: SignalSource;
  externalId: string | null;
  title: string | null;
  content: string;
  author: string | null;
  url: string | null;
  signalDate: string;
  processed: boolean;
  createdAt: string;
  _count: { kpiEvidence: number };
}

export interface SignalListResponse {
  signals: RawSignalResult[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SignalFilters {
  source?: string;
  author?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  processed?: boolean;
  sortBy?: "signalDate" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface SyncJob {
  id: string;
  source: SignalSource;
  accountId: string | null;
  status: JobStatus;
  triggeredBy: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  signalsFound: number | null;
  kpisUpdated: number | null;
  createdAt: string;
}

export interface SyncJobFilters {
  source?: string;
  accountId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface SyncTriggerPayload {
  accountId: string;
  source?: SignalSource;
}

interface SyncResult {
  source: string;
  totalFetched: number;
  newSignals: number;
  duplicatesSkipped: number;
  errors: string[];
}

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

export function useSignals(accountId: string, filters: SignalFilters = {}) {
  return useQuery<SignalListResponse>({
    queryKey: ["signals", accountId, filters],
    queryFn: () =>
      fetchJSON<SignalListResponse>(
        `/api/accounts/${accountId}/signals${buildQueryString({
          source: filters.source,
          author: filters.author,
          search: filters.search,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          processed:
            filters.processed !== undefined
              ? String(filters.processed)
              : undefined,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          page: filters.page?.toString(),
          pageSize: filters.pageSize?.toString(),
        })}`
      ),
    enabled: !!accountId,
  });
}

export function useSyncJobs(filters: SyncJobFilters = {}) {
  return useQuery<{ jobs: SyncJob[]; total: number; page: number; pageSize: number }>({
    queryKey: ["syncJobs", filters],
    queryFn: () =>
      fetchJSON(
        `/api/sync/jobs${buildQueryString({
          source: filters.source,
          accountId: filters.accountId,
          status: filters.status,
          page: filters.page?.toString(),
          pageSize: filters.pageSize?.toString(),
        })}`
      ),
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();
  return useMutation<{ results: SyncResult[] }, Error, SyncTriggerPayload>({
    mutationFn: (payload) =>
      fetchJSON("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["signals", variables.accountId],
      });
      queryClient.invalidateQueries({ queryKey: ["syncJobs"] });
    },
  });
}

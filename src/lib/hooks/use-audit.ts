import { useQuery } from "@tanstack/react-query";

export interface AuditActor {
  id: string;
  name: string | null;
  email: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  metadata: unknown;
  createdAt: string;
  user: AuditActor;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  filterOptions: {
    actions: string[];
    users: AuditActor[];
  };
}

function buildQueryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== ""
  );
  if (entries.length === 0) return "";
  return `?${new URLSearchParams(entries).toString()}`;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery<AuditLogResponse>({
    queryKey: ["audit-logs", filters],
    queryFn: () =>
      fetchJSON<AuditLogResponse>(
        `/api/admin/audit${buildQueryString({
          userId: filters.userId,
          action: filters.action,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          page: filters.page?.toString(),
          pageSize: filters.pageSize?.toString(),
        })}`
      ),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type UserRole = "ADMIN" | "LEADERSHIP" | "CSM" | "VIEWER";

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  _count: {
    accounts: number;
  };
}

export interface CreateUserPayload {
  name?: string;
  email: string;
  role: UserRole;
  password?: string;
}

export interface UpdateUserPayload {
  id: string;
  role?: UserRole;
  isActive?: boolean;
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function useUsers(search?: string) {
  return useQuery<AdminUser[]>({
    queryKey: ["admin-users", search ?? ""],
    queryFn: () =>
      fetchJSON<AdminUser[]>(
        `/api/admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`
      ),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation<AdminUser, Error, CreateUserPayload>({
    mutationFn: (payload) =>
      fetchJSON<AdminUser>("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation<AdminUser, Error, UpdateUserPayload>({
    mutationFn: ({ id, ...payload }) =>
      fetchJSON<AdminUser>(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

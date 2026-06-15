"use client";

import { useCurrentUser } from "@/components/providers/current-user-provider";
import { Role } from "@prisma/client";
import {
  hasPermission,
  getAllPermissions,
  canAccessAccount,
  Permission,
} from "@/lib/rbac";

interface UsePermissionsReturn {
  role: Role | null;
  can: (permission: Permission) => boolean;
  canAll: (permissions: Permission[]) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  canAccessAccount: (accountCsmId: string | null) => boolean;
  permissions: Permission[];
  isAdmin: boolean;
  isLeadership: boolean;
  isCSM: boolean;
  isViewer: boolean;
  isLoading: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const currentUser = useCurrentUser();
  const role = currentUser?.role ?? null;
  const userId = currentUser?.id ?? "";

  const can = (permission: Permission): boolean => {
    if (!role) return false;
    return hasPermission(role, permission);
  };

  const canAll = (permissions: Permission[]): boolean => {
    return permissions.every((p) => can(p));
  };

  const canAny = (permissions: Permission[]): boolean => {
    return permissions.some((p) => can(p));
  };

  const canAccessAccountFn = (accountCsmId: string | null): boolean => {
    if (!role) return false;
    return canAccessAccount(role, userId, accountCsmId);
  };

  return {
    role,
    can,
    canAll,
    canAny,
    canAccessAccount: canAccessAccountFn,
    permissions: role ? getAllPermissions(role) : [],
    isAdmin: role === "ADMIN",
    isLeadership: role === "LEADERSHIP",
    isCSM: role === "CSM",
    isViewer: role === "VIEWER",
    isLoading: false,
  };
}

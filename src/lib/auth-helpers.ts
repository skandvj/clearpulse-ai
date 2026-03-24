import { auth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { hasPermission, Permission, canAccessAccount } from "@/lib/rbac";
import { NextResponse } from "next/server";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
}

export async function getServerUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getServerUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requirePermission(
  permission: Permission
): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (!hasPermission(user.role, permission)) {
    throw new Error(`Forbidden: missing permission "${permission}"`);
  }
  return user;
}

export async function requireAccountAccess(
  accountCsmId: string | null
): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (!canAccessAccount(user.role, user.id, accountCsmId)) {
    throw new Error("Forbidden: no access to this account");
  }
  return user;
}

export function unauthorizedResponse(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = "Forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function errorResponse(
  message: string,
  status = 500
): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function withAuth<T>(
  handler: (user: AuthenticatedUser) => Promise<T>
): Promise<T | NextResponse> {
  try {
    const user = await requireAuth();
    return await handler(user);
  } catch {
    return unauthorizedResponse();
  }
}

export async function withPermission<T>(
  permission: Permission,
  handler: (user: AuthenticatedUser) => Promise<T>
): Promise<T | NextResponse> {
  try {
    const user = await requirePermission(permission);
    return await handler(user);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unauthorized";
    if (message.startsWith("Forbidden")) {
      return forbiddenResponse(message);
    }
    return unauthorizedResponse(message);
  }
}

import { auth } from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";
import { hasPermission, Permission, canAccessAccount } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureUserOrganization } from "@/lib/tenant";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: Role;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
}

export async function getServerUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      role: true,
      isActive: true,
      organizationId: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!currentUser || !currentUser.isActive) {
    return null;
  }

  const organization =
    currentUser.organization ??
    (await ensureUserOrganization(currentUser.id));

  if (!organization) {
    return null;
  }

  return {
    id: currentUser.id,
    email: currentUser.email,
    name: currentUser.name,
    image: currentUser.avatarUrl,
    role: currentUser.role,
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
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

export function getOrganizationWhere(
  user: AuthenticatedUser
): { organizationId: string } {
  return { organizationId: user.organizationId };
}

export function getAccessibleAccountWhere(
  user: AuthenticatedUser,
  accountId?: string
): Prisma.ClientAccountWhereInput {
  return {
    ...(accountId ? { id: accountId } : {}),
    organizationId: user.organizationId,
    ...(user.role === "CSM" ? { csmId: user.id } : {}),
  };
}

export async function requireAccountAccessById(accountId: string): Promise<{
  user: AuthenticatedUser;
  account: {
    id: string;
    name: string;
    csmId: string | null;
    organizationId: string | null;
  };
}> {
  const user = await requireAuth();
  const account = await prisma.clientAccount.findFirst({
    where: getAccessibleAccountWhere(user, accountId),
    select: {
      id: true,
      name: true,
      csmId: true,
      organizationId: true,
    },
  });

  if (!account) {
    throw new Error("Forbidden: no access to this account");
  }

  return { user, account };
}

export async function requireOrgPermission(
  permission: Permission
): Promise<AuthenticatedUser> {
  return requirePermission(permission);
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

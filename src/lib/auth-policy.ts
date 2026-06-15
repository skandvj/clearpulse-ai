import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

const DEMO_WORKSPACE_SLUG = "clearpulse-demo";
const DEMO_WORKSPACE_NAME = "ClearPulse Demo";
const DEMO_USER_EMAIL = "demo@clearpulse.local";
const DEMO_USER_NAME = "Demo Viewer";

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

function parseEmailList(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => normalizeEmail(item))
      .filter(Boolean)
  );
}

export function isDemoAccessEnabled() {
  const value = process.env.DEMO_ACCESS_ENABLED?.trim().toLowerCase();
  if (!value) return true;
  return !["0", "false", "no", "off"].includes(value);
}

export function isSuperAdminEmail(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return parseEmailList(process.env.SUPER_ADMIN_EMAILS).has(normalized);
}

export function getProvisionedRole(
  email: string,
  existingRole?: Role | null,
  fallbackRole: Role = "CSM"
) {
  if (isSuperAdminEmail(email)) {
    return "ADMIN" satisfies Role;
  }

  return existingRole ?? fallbackRole;
}

export async function syncUserRoleIfNeeded(user: {
  id: string;
  email: string;
  role: Role;
  isActive?: boolean;
}) {
  const nextRole = getProvisionedRole(user.email, user.role);
  const nextIsActive = user.isActive ?? true;

  if (nextRole === user.role && nextIsActive === user.isActive) {
    return user.role;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      role: nextRole,
      ...(user.isActive === undefined ? {} : { isActive: nextIsActive }),
    },
    select: { role: true },
  });

  return updated.role;
}

export async function ensureDemoAccessUser() {
  const organization = await prisma.organization.upsert({
    where: { slug: DEMO_WORKSPACE_SLUG },
    update: { name: DEMO_WORKSPACE_NAME, domain: null },
    create: {
      slug: DEMO_WORKSPACE_SLUG,
      name: DEMO_WORKSPACE_NAME,
      domain: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {
      name: DEMO_USER_NAME,
      role: "VIEWER",
      isActive: true,
      organizationId: organization.id,
    },
    create: {
      email: DEMO_USER_EMAIL,
      name: DEMO_USER_NAME,
      role: "VIEWER",
      isActive: true,
      organizationId: organization.id,
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      role: true,
    },
  });

  return {
    organization,
    user,
  };
}

import { prisma } from "@/lib/db";

const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "gmx.com",
  "zoho.com",
]);

export interface OrganizationContext {
  id: string;
  name: string;
  slug: string;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function titleCase(value: string) {
  return value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getEmailDomain(email: string) {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return domain || null;
}

function getDomainLabel(domain: string | null) {
  if (!domain) return null;
  const [label] = domain.split(".");
  return label ? titleCase(label) : null;
}

function buildOrganizationName(args: {
  email: string;
  name?: string | null;
  domain: string | null;
}) {
  if (args.domain && !GENERIC_EMAIL_DOMAINS.has(args.domain)) {
    return `${getDomainLabel(args.domain) ?? "Customer"} Workspace`;
  }

  const personName =
    args.name?.trim() ||
    args.email
      .split("@")[0]
      ?.replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  return `${titleCase(personName || "Personal")} Workspace`;
}

async function createUniqueOrganizationSlug(baseValue: string) {
  const baseSlug = slugify(baseValue) || "workspace";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug =
      attempt === 0
        ? baseSlug
        : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    const existing = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }
  }

  return `${baseSlug}-${Date.now().toString(36)}`;
}

async function backfillFirstOrganization(orgId: string) {
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { organizationId: null },
      data: { organizationId: orgId },
    }),
    prisma.clientAccount.updateMany({
      where: { organizationId: null },
      data: { organizationId: orgId },
    }),
    prisma.auditLog.updateMany({
      where: { organizationId: null },
      data: { organizationId: orgId },
    }),
    prisma.integrationSetting.updateMany({
      where: { organizationId: null },
      data: { organizationId: orgId },
    }),
    prisma.aiSetting.updateMany({
      where: { organizationId: null },
      data: { organizationId: orgId },
    }),
    prisma.kpiFrameworkSetting.updateMany({
      where: { organizationId: null },
      data: { organizationId: orgId },
    }),
    prisma.syncJob.updateMany({
      where: { organizationId: null },
      data: { organizationId: orgId },
    }),
  ]);
}

export async function ensureUserOrganization(
  userId: string
): Promise<OrganizationContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
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

  if (!user) {
    throw new Error("User not found");
  }

  if (user.organization) {
    return user.organization;
  }

  const domain = getEmailDomain(user.email);
  const organizationCount = await prisma.organization.count();
  const shareByDomain = Boolean(
    domain && !GENERIC_EMAIL_DOMAINS.has(domain)
  );

  let organization =
    shareByDomain && domain
      ? await prisma.organization.findUnique({
          where: { domain },
          select: { id: true, name: true, slug: true },
        })
      : null;

  if (!organization) {
    const name = buildOrganizationName({
      email: user.email,
      name: user.name,
      domain,
    });
    const slug = await createUniqueOrganizationSlug(name);

    organization = await prisma.organization.create({
      data: {
        name,
        slug,
        domain: shareByDomain ? domain : null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (organizationCount === 0) {
      await backfillFirstOrganization(organization.id);
    }
  }

  if (user.organizationId !== organization.id) {
    await prisma.user.update({
      where: { id: user.id },
      data: { organizationId: organization.id },
    });
  }

  return organization;
}

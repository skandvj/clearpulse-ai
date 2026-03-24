import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { createAccountSchema } from "@/lib/validations/account";
import { Prisma } from "@prisma/client";
import { getTierVariants, normalizeTier } from "@/lib/accounts";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = request.nextUrl;

    const search = searchParams.get("search");
    const tier = searchParams.get("tier");
    const healthStatus = searchParams.get("healthStatus");
    const csmId = searchParams.get("csmId");
    const sortBy = searchParams.get("sortBy") ?? "name";
    const sortOrder =
      searchParams.get("sortOrder") ??
      searchParams.get("sortDir") ??
      "asc";

    const where: Prisma.ClientAccountWhereInput = {};

    if (user.role === "CSM") {
      where.csmId = user.id;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { domain: { contains: search, mode: "insensitive" } },
      ];
    }

    if (tier) {
      const tierVariants = getTierVariants(tier);
      if (tierVariants.length === 1) {
        where.tier = tierVariants[0];
      } else if (tierVariants.length > 1) {
        where.tier = { in: tierVariants };
      }
    }

    if (healthStatus) {
      where.healthStatus = healthStatus as Prisma.EnumHealthStatusFilter;
    }

    if (csmId) {
      where.csmId = csmId;
    }

    const orderDir = sortOrder === "desc" ? "desc" : "asc";
    let orderBy: Prisma.ClientAccountOrderByWithRelationInput = {
      name: orderDir,
    };

    switch (sortBy) {
      case "name":
      case "domain":
      case "tier":
      case "healthScore":
      case "healthStatus":
      case "lastSyncedAt":
      case "createdAt":
      case "updatedAt":
        orderBy = { [sortBy]: orderDir };
        break;
      case "kpiCount":
        orderBy = { kpis: { _count: orderDir } };
        break;
      default:
        break;
    }

    const accounts = await prisma.clientAccount.findMany({
      where,
      orderBy,
      include: {
        csm: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { kpis: true, signals: true } },
      },
    });

    return NextResponse.json(
      accounts.map((account) => ({
        ...account,
        tier: normalizeTier(account.tier),
      }))
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    return errorResponse("Failed to fetch accounts");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EDIT_ACCOUNT_FIELDS);

    const body = await request.json();
    const result = createAccountSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400);
    }

    const account = await prisma.clientAccount.create({
      data: {
        ...result.data,
        tier: normalizeTier(result.data.tier) ?? undefined,
      },
      include: {
        csm: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    return NextResponse.json(
      {
        ...account,
        tier: normalizeTier(account.tier),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to create account");
  }
}

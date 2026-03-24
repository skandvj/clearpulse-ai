import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAccountAccess,
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { updateAccountSchema } from "@/lib/validations/account";
import { normalizeTier } from "@/lib/accounts";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const account = await prisma.clientAccount.findUnique({
      where: { id: params.id },
      include: {
        csm: { select: { id: true, name: true, email: true, avatarUrl: true } },
        kpis: {
          include: { _count: { select: { evidence: true } } },
        },
        contacts: true,
        meetings: {
          orderBy: { meetingDate: "desc" },
          take: 5,
        },
      },
    });

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    await requireAccountAccess(account.csmId);

    return NextResponse.json({
      ...account,
      tier: normalizeTier(account.tier),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to fetch account");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(PERMISSIONS.EDIT_ACCOUNT_FIELDS);

    const account = await prisma.clientAccount.findUnique({
      where: { id: params.id },
      select: { csmId: true },
    });

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    await requireAccountAccess(account.csmId);

    const body = await request.json();
    const result = updateAccountSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400);
    }

    const updated = await prisma.clientAccount.update({
      where: { id: params.id },
      data: {
        ...result.data,
        tier:
          result.data.tier === undefined
            ? undefined
            : result.data.tier === null
              ? null
              : normalizeTier(result.data.tier),
      },
      include: {
        csm: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({
      ...updated,
      tier: normalizeTier(updated.tier),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to update account");
  }
}

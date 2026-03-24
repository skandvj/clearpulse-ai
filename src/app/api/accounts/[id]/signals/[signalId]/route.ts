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

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; signalId: string } }
) {
  try {
    const account = await prisma.clientAccount.findUnique({
      where: { id: params.id },
      select: { csmId: true },
    });

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    await requireAccountAccess(account.csmId);

    const signal = await prisma.rawSignal.findUnique({
      where: { id: params.signalId, accountId: params.id },
      include: {
        kpiEvidence: {
          include: {
            kpi: {
              select: { id: true, metricName: true, category: true },
            },
          },
          orderBy: { relevance: "desc" },
        },
      },
    });

    if (!signal) {
      return errorResponse("Signal not found", 404);
    }

    return NextResponse.json(signal);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden"))
        return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to fetch signal");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; signalId: string } }
) {
  try {
    await requirePermission(PERMISSIONS.EDIT_ACCOUNT_FIELDS);

    const signal = await prisma.rawSignal.findUnique({
      where: { id: params.signalId, accountId: params.id },
    });

    if (!signal) {
      return errorResponse("Signal not found", 404);
    }

    await prisma.kPIEvidence.deleteMany({ where: { signalId: params.signalId } });
    await prisma.rawSignal.delete({ where: { id: params.signalId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden"))
        return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to delete signal");
  }
}

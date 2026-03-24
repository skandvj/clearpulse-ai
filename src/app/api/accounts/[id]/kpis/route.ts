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
import { createKPISchema } from "@/lib/validations/kpi";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
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

    const kpis = await prisma.clientKPI.findMany({
      where: { accountId: params.id },
      include: { _count: { select: { evidence: true } } },
    });

    return NextResponse.json(kpis);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to fetch KPIs");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(PERMISSIONS.EDIT_KPIS);

    const account = await prisma.clientAccount.findUnique({
      where: { id: params.id },
      select: { csmId: true },
    });

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    await requireAccountAccess(account.csmId);

    const body = await request.json();
    const result = createKPISchema.safeParse(body);

    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400);
    }

    const kpi = await prisma.clientKPI.create({
      data: {
        accountId: params.id,
        ...result.data,
      },
    });

    if (result.data.currentValue) {
      await prisma.kPIHistory.create({
        data: {
          kpiId: kpi.id,
          value: result.data.currentValue,
          changedBy: user.id,
          note: "Initial value",
        },
      });
    }

    return NextResponse.json(kpi, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to create KPI");
  }
}

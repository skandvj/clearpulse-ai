import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { updateKPISchema } from "@/lib/validations/kpi";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; kpiId: string } }
) {
  try {
    const user = await requirePermission(PERMISSIONS.EDIT_KPIS);

    const kpi = await prisma.clientKPI.findUnique({
      where: { id: params.kpiId, accountId: params.id },
    });

    if (!kpi) {
      return errorResponse("KPI not found", 404);
    }

    const body = await request.json();
    const result = updateKPISchema.safeParse(body);

    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400);
    }

    const updated = await prisma.clientKPI.update({
      where: { id: params.kpiId },
      data: result.data,
    });

    const valueChanged =
      result.data.currentValue !== undefined &&
      result.data.currentValue !== kpi.currentValue;

    if (valueChanged && result.data.currentValue != null) {
      await prisma.kPIHistory.create({
        data: {
          kpiId: kpi.id,
          value: result.data.currentValue,
          healthScore: result.data.healthScore ?? kpi.healthScore,
          healthStatus: result.data.healthStatus ?? kpi.healthStatus,
          changedBy: user.id,
          note: result.data.notes ?? null,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to update KPI");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; kpiId: string } }
) {
  try {
    await requirePermission(PERMISSIONS.EDIT_KPIS);

    const kpi = await prisma.clientKPI.findUnique({
      where: { id: params.kpiId, accountId: params.id },
    });

    if (!kpi) {
      return errorResponse("KPI not found", 404);
    }

    await prisma.kPIEvidence.deleteMany({ where: { kpiId: params.kpiId } });
    await prisma.kPIHistory.deleteMany({ where: { kpiId: params.kpiId } });
    await prisma.clientKPI.delete({ where: { id: params.kpiId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to delete KPI");
  }
}

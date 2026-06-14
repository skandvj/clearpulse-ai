import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import {
  buildKpiFrameworkFieldStates,
  loadKpiFrameworkReferenceData,
  upsertKpiFrameworkSettings,
} from "@/lib/kpi-framework";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  values: z
    .object({
      WORKING_KPI_MIN_EVIDENCE_COUNT: z.number().int().min(1).max(5).optional(),
      REQUIRE_EXPLICIT_METRIC_FOR_WORKING_KPI: z.boolean().optional(),
      ALLOW_BLOCKER_PROMOTION: z.boolean().optional(),
      FATHOM_SINGLE_SIGNAL_DEFAULT: z.enum(["suggested", "working"]).optional(),
    })
    .default({}),
});

export async function GET() {
  try {
    const user = await requirePermission(PERMISSIONS.CONFIGURE_INTEGRATIONS);

    const [fields, referenceData] = await Promise.all([
      buildKpiFrameworkFieldStates(user.organizationId),
      loadKpiFrameworkReferenceData(),
    ]);

    return NextResponse.json({
      settings: { fields },
      referenceData,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
    }

    return errorResponse("Failed to fetch KPI framework");
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requirePermission(PERMISSIONS.CONFIGURE_INTEGRATIONS);
    const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));

    if (!parsed.success) {
      return errorResponse("Invalid KPI framework payload", 400);
    }

    await upsertKpiFrameworkSettings({
      organizationId: user.organizationId,
      userId: user.id,
      values: parsed.data.values,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        action: "KPI_FRAMEWORK_UPDATED",
        entityType: "KPIFramework",
        entityId: user.organizationId,
        metadata: {
          keysUpdated: Object.keys(parsed.data.values),
        },
      },
    });

    const fields = await buildKpiFrameworkFieldStates(user.organizationId);

    return NextResponse.json({
      message: "KPI framework updated.",
      settings: { fields },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
    }

    return errorResponse("Failed to update KPI framework");
  }
}

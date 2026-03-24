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
import { runAccountHealthScoring } from "@/lib/ai/scoreKPIHealth";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(PERMISSIONS.RUN_HEALTH_RESCORE);

    const account = await prisma.clientAccount.findUnique({
      where: { id: params.id },
      select: { csmId: true },
    });

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    await requireAccountAccess(account.csmId);

    const summary = await runAccountHealthScoring(params.id, user.id);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
      if (error.message === "ANTHROPIC_API_KEY is not configured") {
        return errorResponse("AI health scoring is not configured on the server", 503);
      }
    }

    console.error("[api/score]", error);
    return errorResponse(
      error instanceof Error ? error.message : "Health scoring failed"
    );
  }
}

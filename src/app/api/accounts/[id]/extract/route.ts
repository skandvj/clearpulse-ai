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
import { runKpiExtraction } from "@/lib/ai/extractKPIs";
import { runAccountHealthScoring } from "@/lib/ai/scoreKPIHealth";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(PERMISSIONS.TRIGGER_SOURCE_SYNC);

    const account = await prisma.clientAccount.findUnique({
      where: { id: params.id },
      select: { csmId: true },
    });

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    await requireAccountAccess(account.csmId);

    const summary = await runKpiExtraction(params.id, user.id);

    try {
      const scoring = await runAccountHealthScoring(params.id, user.id);
      return NextResponse.json({
        ...summary,
        scoring,
      });
    } catch (scoringError) {
      console.error("[api/extract] health scoring failed after extraction", scoringError);
      return NextResponse.json({
        ...summary,
        scoringError:
          scoringError instanceof Error
            ? scoringError.message
            : "Health scoring failed after extraction",
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
      if (error.message === "ANTHROPIC_API_KEY is not configured") {
        return errorResponse("AI extraction is not configured on the server", 503);
      }
    }
    console.error("[api/extract]", error);
    return errorResponse(
      error instanceof Error ? error.message : "KPI extraction failed"
    );
  }
}

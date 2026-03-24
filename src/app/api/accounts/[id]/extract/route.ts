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
import { logError } from "@/lib/logging";
import {
  applyRateLimitHeaders,
  buildRateLimitKey,
  checkRateLimit,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

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

    const rateLimit = await checkRateLimit({
      key: buildRateLimitKey({
        request: _request,
        scope: "account-extract",
        userId: user.id,
        resource: params.id,
      }),
      limit: 15,
      windowSeconds: 10 * 60,
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        "Too many KPI extraction requests for this account. Please wait a few minutes before retrying."
      );
    }

    const summary = await runKpiExtraction(params.id, user.id);

    try {
      const scoring = await runAccountHealthScoring(params.id, user.id);
      const response = NextResponse.json({
        ...summary,
        scoring,
      });
      return applyRateLimitHeaders(response, rateLimit);
    } catch (scoringError) {
      logError("api.extract.post_scoring_failed", scoringError, {
        accountId: params.id,
        userId: user.id,
      });
      const response = NextResponse.json({
        ...summary,
        scoringError:
          scoringError instanceof Error
            ? scoringError.message
            : "Health scoring failed after extraction",
      });
      return applyRateLimitHeaders(response, rateLimit);
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
    logError("api.extract.failed", error, {
      accountId: params.id,
    });
    return errorResponse(
      error instanceof Error ? error.message : "KPI extraction failed"
    );
  }
}

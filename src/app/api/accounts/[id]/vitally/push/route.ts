import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  errorResponse,
  forbiddenResponse,
  requireAccountAccess,
  requirePermission,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { pushAccountHealthToVitally } from "@/lib/integrations/vitally";
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
    const user = await requirePermission(PERMISSIONS.PUSH_TO_VITALLY);

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
        scope: "account-vitally-push",
        userId: user.id,
        resource: params.id,
      }),
      limit: 20,
      windowSeconds: 10 * 60,
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        "Too many Vitally push requests for this account. Please wait a few minutes before retrying."
      );
    }

    const summary = await pushAccountHealthToVitally(params.id, user.id);
    const response = NextResponse.json(summary);
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
      if (error.message === "VITALLY_API_KEY is not configured") {
        return errorResponse("Vitally integration is not configured on the server", 503);
      }
      return errorResponse(error.message);
    }

    return errorResponse("Failed to push account data to Vitally");
  }
}

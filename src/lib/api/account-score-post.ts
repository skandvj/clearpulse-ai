import { NextResponse } from "next/server";
import {
  applyRateLimitHeaders,
  buildRateLimitKey,
  rateLimitExceededResponse,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { jsonError, jsonForbidden, jsonUnauthorized } from "./response-helpers";

export interface AccountRouteUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
}

export interface AccountAccessRecord {
  id?: string;
  csmId: string | null;
}

export interface AccountScorePostHandlerDeps {
  requirePermission: () => Promise<AccountRouteUser>;
  requireAccountAccess: (accountCsmId: string | null) => Promise<AccountRouteUser>;
  getAccountById: (accountId: string) => Promise<AccountAccessRecord | null>;
  checkRateLimit: (input: {
    key: string;
    limit: number;
    windowSeconds: number;
  }) => Promise<RateLimitResult>;
  runAccountHealthScoring: (
    accountId: string,
    userId: string
  ) => Promise<unknown>;
  logError?: (event: string, error: unknown, data?: Record<string, unknown>) => void;
}

function mapAuthError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return jsonUnauthorized();
    }

    if (error.message.startsWith("Forbidden")) {
      return jsonForbidden(error.message);
    }

    if (
      error.message === "AI text provider is not configured" ||
      error.message === "ANTHROPIC_API_KEY is not configured" ||
      error.message === "GEMINI_API_KEY is not configured"
    ) {
      return jsonError("AI health scoring is not configured on the server", 503);
    }

    return jsonError(error.message);
  }

  return jsonError("Health scoring failed");
}

export function createAccountScorePostHandler(
  deps: AccountScorePostHandlerDeps
) {
  return async function POST(
    request: Request,
    { params }: { params: { id: string } }
  ) {
    try {
      const user = await deps.requirePermission();

      const account = await deps.getAccountById(params.id);
      if (!account) {
        return jsonError("Account not found", 404);
      }

      await deps.requireAccountAccess(account.csmId);

      const rateLimit = await deps.checkRateLimit({
        key: buildRateLimitKey({
          request,
          scope: "account-score",
          userId: user.id,
          resource: params.id,
        }),
        limit: 30,
        windowSeconds: 10 * 60,
      });
      if (!rateLimit.allowed) {
        return rateLimitExceededResponse(
          rateLimit,
          "Too many health re-score requests for this account. Please wait a few minutes before retrying."
        );
      }

      const summary = await deps.runAccountHealthScoring(params.id, user.id);
      const response = NextResponse.json(summary);
      return applyRateLimitHeaders(response, rateLimit);
    } catch (error) {
      deps.logError?.("api.score.failed", error, {
        accountId: params.id,
      });
      return mapAuthError(error);
    }
  };
}

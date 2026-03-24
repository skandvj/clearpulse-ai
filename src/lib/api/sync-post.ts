import { NextResponse } from "next/server";
import { SignalSource } from "@prisma/client";
import type { SyncDispatchResult } from "@/lib/ingestion/queue";
import {
  applyRateLimitHeaders,
  buildRateLimitKey,
  rateLimitExceededResponse,
  type RateLimitResult,
} from "@/lib/rate-limit";
import {
  jsonError,
  jsonForbidden,
  jsonUnauthorized,
} from "@/lib/api/response-helpers";

const VALID_SOURCES = new Set<string>([
  "SLACK",
  "FATHOM",
  "AM_MEETING",
  "VITALLY",
  "SALESFORCE",
  "PERSONAS",
  "SHAREPOINT",
  "JIRA",
  "GOOGLE_DRIVE",
]);

export interface SyncRouteUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
}

export interface SyncRouteAccount {
  id: string;
  name: string;
  csmId: string | null;
}

export interface SyncPostHandlerDeps {
  requirePermission: () => Promise<SyncRouteUser>;
  requireAccountAccess: (accountCsmId: string | null) => Promise<SyncRouteUser>;
  getAccountById: (accountId: string) => Promise<SyncRouteAccount | null>;
  listAccountsForUser: (
    user: SyncRouteUser
  ) => Promise<Array<Pick<SyncRouteAccount, "id" | "name">>>;
  enqueueIngestion: (
    source: SignalSource,
    accountId: string,
    userId: string
  ) => Promise<SyncDispatchResult>;
  enqueueBulkSync: (
    accountId: string,
    userId: string
  ) => Promise<SyncDispatchResult>;
  checkRateLimit: (input: {
    key: string;
    limit: number;
    windowSeconds: number;
  }) => Promise<RateLimitResult>;
}

function mapAuthError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return jsonUnauthorized();
    }

    if (error.message.startsWith("Forbidden")) {
      return jsonForbidden(error.message);
    }
  }

  return null;
}

export function createSyncPostHandler(deps: SyncPostHandlerDeps) {
  return async function POST(request: Request) {
    try {
      const user = await deps.requirePermission();
      const body = await request.json().catch(() => ({}));
      const { source, accountId } = body as {
        source?: string;
        accountId?: string;
      };

      if (source && !VALID_SOURCES.has(source)) {
        return jsonError(`Invalid source: ${source}`, 400);
      }

      if (accountId && typeof accountId !== "string") {
        return jsonError("accountId must be a string", 400);
      }

      if (!accountId && !source) {
        return jsonError("Provide accountId or source", 400);
      }

      if (accountId) {
        const account = await deps.getAccountById(accountId);

        if (!account) {
          return jsonError("Account not found", 404);
        }

        await deps.requireAccountAccess(account.csmId);

        const rateLimit = await deps.checkRateLimit({
          key: buildRateLimitKey({
            request,
            scope: "sync:account",
            userId: user.id,
            resource: `${account.id}:${source ?? "all"}`,
          }),
          limit: 20,
          windowSeconds: 10 * 60,
        });
        if (!rateLimit.allowed) {
          return rateLimitExceededResponse(
            rateLimit,
            "Too many account sync requests. Please wait a few minutes before trying again."
          );
        }

        const dispatch = source
          ? await deps.enqueueIngestion(
              source as SignalSource,
              accountId,
              user.id
            )
          : await deps.enqueueBulkSync(accountId, user.id);

        const response = NextResponse.json({
          target: "account",
          account: {
            id: account.id,
            name: account.name,
          },
          source: source ?? null,
          ...dispatch,
        });
        return applyRateLimitHeaders(response, rateLimit);
      }

      const accounts = await deps.listAccountsForUser(user);
      const rateLimit = await deps.checkRateLimit({
        key: buildRateLimitKey({
          request,
          scope: "sync:source",
          userId: user.id,
          resource: source ?? "all",
        }),
        limit: 6,
        windowSeconds: 10 * 60,
      });
      if (!rateLimit.allowed) {
        return rateLimitExceededResponse(
          rateLimit,
          "Too many source-wide sync requests. Please wait before retrying."
        );
      }

      if (accounts.length === 0) {
        const response = NextResponse.json({
          target: "source",
          source,
          accountCount: 0,
          mode: "inline",
          results: [],
        });
        return applyRateLimitHeaders(response, rateLimit);
      }

      const dispatches = await Promise.all(
        accounts.map((account) =>
          deps.enqueueIngestion(source as SignalSource, account.id, user.id)
        )
      );

      if (dispatches[0]?.mode === "queued") {
        const response = NextResponse.json({
          target: "source",
          source,
          accountCount: accounts.length,
          mode: "queued",
          jobs: dispatches.flatMap((dispatch) =>
            dispatch.mode === "queued" ? dispatch.jobs : []
          ),
        });
        return applyRateLimitHeaders(response, rateLimit);
      }

      const response = NextResponse.json({
        target: "source",
        source,
        accountCount: accounts.length,
        mode: "inline",
        results: dispatches.flatMap((dispatch) =>
          dispatch.mode === "inline" ? dispatch.results : []
        ),
      });
      return applyRateLimitHeaders(response, rateLimit);
    } catch (error) {
      return mapAuthError(error) ?? jsonError("Failed to trigger sync");
    }
  };
}

import { NextRequest, NextResponse } from "next/server";
import { Prisma, SignalSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireAccountAccess,
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { enqueueBulkSync, enqueueIngestion } from "@/lib/ingestion/queue";
import {
  applyRateLimitHeaders,
  buildRateLimitKey,
  checkRateLimit,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

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

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.TRIGGER_SOURCE_SYNC);
    const body = await request.json().catch(() => ({}));
    const { source, accountId } = body as {
      source?: string;
      accountId?: string;
    };

    if (source && !VALID_SOURCES.has(source)) {
      return errorResponse(`Invalid source: ${source}`, 400);
    }

    if (accountId && typeof accountId !== "string") {
      return errorResponse("accountId must be a string", 400);
    }

    if (!accountId && !source) {
      return errorResponse("Provide accountId or source", 400);
    }

    if (accountId) {
      const account = await prisma.clientAccount.findUnique({
        where: { id: accountId },
        select: { id: true, name: true, csmId: true },
      });

      if (!account) {
        return errorResponse("Account not found", 404);
      }

      await requireAccountAccess(account.csmId);

      const rateLimit = await checkRateLimit({
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
        ? await enqueueIngestion(source as SignalSource, accountId, user.id)
        : await enqueueBulkSync(accountId, user.id);

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

    const accountWhere: Prisma.ClientAccountWhereInput =
      user.role === "CSM" ? { csmId: user.id } : {};
    const accounts = await prisma.clientAccount.findMany({
      where: accountWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    if (accounts.length === 0) {
      const rateLimit = await checkRateLimit({
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

      const response = NextResponse.json({
        target: "source",
        source,
        accountCount: 0,
        mode: "inline",
        results: [],
      });
      return applyRateLimitHeaders(response, rateLimit);
    }

    const rateLimit = await checkRateLimit({
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

    const dispatches = await Promise.all(
      accounts.map((account) =>
        enqueueIngestion(source as SignalSource, account.id, user.id)
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
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
    }

    return errorResponse("Failed to trigger sync");
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { JobStatus, Prisma, SignalSource } from "@prisma/client";
import {
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { isQueueAvailable } from "@/lib/ingestion/redis";

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

const VALID_STATUSES = new Set<string>([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.VIEW_SYNC_CONSOLE);

    const url = request.nextUrl;
    const sourceParam = url.searchParams.get("source");
    const accountId = url.searchParams.get("accountId");
    const statusParam = url.searchParams.get("status");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "25", 10))
    );

    const where: Prisma.SyncJobWhereInput = {};

    if (sourceParam && VALID_SOURCES.has(sourceParam)) {
      where.source = sourceParam as SignalSource;
    }

    if (accountId) {
      where.accountId = accountId;
    }

    if (statusParam && VALID_STATUSES.has(statusParam)) {
      where.status = statusParam as JobStatus;
    }

    const [jobs, total, grouped] = await Promise.all([
      prisma.syncJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.syncJob.count({ where }),
      prisma.syncJob.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
    ]);

    const summary = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };

    for (const group of grouped) {
      const count = group._count._all;
      if (group.status === "PENDING") summary.pending = count;
      if (group.status === "RUNNING") summary.running = count;
      if (group.status === "COMPLETED") summary.completed = count;
      if (group.status === "FAILED") summary.failed = count;
    }

    const accountIds = Array.from(
      new Set(
        jobs
          .map((job) => job.accountId)
          .filter((accountId): accountId is string => !!accountId)
      )
    );

    const accounts =
      accountIds.length === 0
        ? []
        : await prisma.clientAccount.findMany({
            where: {
              id: {
                in: accountIds,
              },
            },
            select: {
              id: true,
              name: true,
            },
          });

    const accountById = new Map(
      accounts.map((account) => [account.id, account] as const)
    );

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        ...job,
        account: job.accountId ? accountById.get(job.accountId) ?? null : null,
      })),
      total,
      page,
      pageSize,
      queueMode: isQueueAvailable() ? "queued" : "inline",
      summary,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
    }

    return errorResponse("Failed to fetch sync jobs");
  }
}

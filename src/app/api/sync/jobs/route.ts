import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SignalSource, JobStatus, Prisma } from "@prisma/client";
import {
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";

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

    const [jobs, total] = await Promise.all([
      prisma.syncJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.syncJob.count({ where }),
    ]);

    return NextResponse.json({ jobs, total, page, pageSize });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden"))
        return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to fetch sync jobs");
  }
}

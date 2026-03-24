import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";

function buildDateRange(dateFrom: string | null, dateTo: string | null) {
  const createdAt: Prisma.DateTimeFilter = {};

  if (dateFrom) {
    const start = new Date(dateFrom);
    if (!Number.isNaN(start.getTime())) {
      createdAt.gte = start;
    }
  }

  if (dateTo) {
    const end = new Date(dateTo);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
  }

  return Object.keys(createdAt).length > 0 ? createdAt : undefined;
}

function toCsvCell(value: unknown): string {
  const stringValue =
    value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.VIEW_AUDIT_LOGS);

    const url = request.nextUrl;
    const userId = url.searchParams.get("userId");
    const action = url.searchParams.get("action");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const format = url.searchParams.get("format");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "25", 10))
    );

    const where: Prisma.AuditLogWhereInput = {};

    if (userId) {
      where.userId = userId;
    }

    if (action) {
      where.action = action;
    }

    const createdAt = buildDateRange(dateFrom, dateTo);
    if (createdAt) {
      where.createdAt = createdAt;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...(format === "csv"
        ? {}
        : {
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const accountIds = Array.from(
      new Set(
        logs
          .filter((log) => log.entityType === "ClientAccount")
          .map((log) => log.entityId)
      )
    );
    const targetUserIds = Array.from(
      new Set(
        logs
          .filter((log) => log.entityType === "User")
          .map((log) => log.entityId)
      )
    );

    const [accounts, users, total, actionGroups, actorIds] = await Promise.all([
      accountIds.length > 0
        ? prisma.clientAccount.findMany({
            where: { id: { in: accountIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      targetUserIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: targetUserIds } },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
      format === "csv" ? Promise.resolve(logs.length) : prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({
        by: ["action"],
        _count: { _all: true },
      }),
      prisma.auditLog.groupBy({
        by: ["userId"],
        _count: { _all: true },
      }),
    ]);

    const actorOptions =
      actorIds.length === 0
        ? []
        : await prisma.user.findMany({
            where: {
              id: { in: actorIds.map((entry) => entry.userId) },
            },
            select: {
              id: true,
              name: true,
              email: true,
            },
            orderBy: [{ name: "asc" }, { email: "asc" }],
          });

    const accountById = new Map(accounts.map((account) => [account.id, account.name]));
    const userById = new Map(
      users.map((user) => [user.id, user.name?.trim() || user.email])
    );

    const enrichedLogs = logs.map((log) => ({
      ...log,
      entityLabel:
        log.entityType === "ClientAccount"
          ? accountById.get(log.entityId) ?? null
          : log.entityType === "User"
            ? userById.get(log.entityId) ?? null
            : null,
    }));

    if (format === "csv") {
      const rows = [
        ["Timestamp", "Actor", "Action", "Entity Type", "Entity", "Metadata"],
        ...enrichedLogs.map((log) => [
          log.createdAt.toISOString(),
          log.user.name || log.user.email,
          log.action,
          log.entityType,
          log.entityLabel || log.entityId,
          log.metadata,
        ]),
      ];

      const csv = rows
        .map((row) => row.map((cell) => toCsvCell(cell)).join(","))
        .join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="audit-log.csv"',
        },
      });
    }

    return NextResponse.json({
      logs: enrichedLogs,
      total,
      page,
      pageSize,
      filterOptions: {
        actions: actionGroups.map((group) => group.action).sort(),
        users: actorOptions,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
    }

    return errorResponse("Failed to fetch audit logs");
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SignalSource, Prisma } from "@prisma/client";
import {
  requireAccountAccess,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";

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

const VALID_SORT_FIELDS = new Set(["signalDate", "createdAt"]);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const account = await prisma.clientAccount.findUnique({
      where: { id: params.id },
      select: { csmId: true },
    });

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    await requireAccountAccess(account.csmId);

    const url = request.nextUrl;
    const sourceParam = url.searchParams.get("source");
    const author = url.searchParams.get("author");
    const search = url.searchParams.get("search");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const processedParam = url.searchParams.get("processed");
    const sortBy = url.searchParams.get("sortBy") ?? "signalDate";
    const sortOrder = url.searchParams.get("sortOrder") ?? "desc";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "25", 10))
    );

    const where: Prisma.RawSignalWhereInput = { accountId: params.id };

    if (sourceParam) {
      const sources = sourceParam.split(",").filter((s) => VALID_SOURCES.has(s));
      if (sources.length === 1) {
        where.source = sources[0] as SignalSource;
      } else if (sources.length > 1) {
        where.source = { in: sources as SignalSource[] };
      }
    }

    if (author) {
      where.author = { contains: author, mode: "insensitive" };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ];
    }

    if (dateFrom || dateTo) {
      where.signalDate = {};
      if (dateFrom) where.signalDate.gte = new Date(dateFrom);
      if (dateTo) where.signalDate.lte = new Date(dateTo);
    }

    if (processedParam !== null) {
      where.processed = processedParam === "true";
    }

    const orderField = VALID_SORT_FIELDS.has(sortBy) ? sortBy : "signalDate";
    const orderDir = sortOrder === "asc" ? "asc" : "desc";

    const [signals, total] = await Promise.all([
      prisma.rawSignal.findMany({
        where,
        include: { _count: { select: { kpiEvidence: true } } },
        orderBy: { [orderField]: orderDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.rawSignal.count({ where }),
    ]);

    return NextResponse.json({ signals, total, page, pageSize });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden"))
        return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to fetch signals");
  }
}

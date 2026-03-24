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

const SOURCES = new Set<string>(Object.values(SignalSource));

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; kpiId: string } }
) {
  try {
    await requirePermission(PERMISSIONS.VIEW_SIGNAL_EVIDENCE);

    const account = await prisma.clientAccount.findUnique({
      where: { id: params.id },
      select: { csmId: true },
    });

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    await requireAccountAccess(account.csmId);

    const kpi = await prisma.clientKPI.findFirst({
      where: { id: params.kpiId, accountId: params.id },
      select: { id: true, metricName: true },
    });

    if (!kpi) {
      return errorResponse("KPI not found", 404);
    }

    const { searchParams } = new URL(request.url);
    const sourceParam = searchParams.get("source");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (sourceParam && !SOURCES.has(sourceParam)) {
      return errorResponse("Invalid source filter", 400);
    }

    const signalFilter: Prisma.RawSignalWhereInput = {};

    if (sourceParam) {
      signalFilter.source = sourceParam as SignalSource;
    }
    if (dateFrom || dateTo) {
      signalFilter.signalDate = {};
      if (dateFrom) {
        const d = new Date(dateFrom);
        if (Number.isNaN(d.getTime())) {
          return errorResponse("Invalid dateFrom", 400);
        }
        signalFilter.signalDate.gte = d;
      }
      if (dateTo) {
        const d = new Date(dateTo);
        if (Number.isNaN(d.getTime())) {
          return errorResponse("Invalid dateTo", 400);
        }
        signalFilter.signalDate.lte = d;
      }
    }

    const evidenceWhere: Prisma.KPIEvidenceWhereInput = {
      kpiId: params.kpiId,
    };
    if (Object.keys(signalFilter).length > 0) {
      evidenceWhere.signal = signalFilter;
    }

    const contacts = await prisma.contact.findMany({
      where: { accountId: params.id },
      select: { name: true },
    });

    const priorityNames = new Set(
      contacts
        .map((c) => c.name.trim().toLowerCase())
        .filter((n) => n.length > 0)
    );
    const priorityNamesList = Array.from(priorityNames);

    const rows = await prisma.kPIEvidence.findMany({
      where: evidenceWhere,
      include: {
        signal: {
          select: {
            id: true,
            source: true,
            title: true,
            content: true,
            author: true,
            url: true,
            signalDate: true,
          },
        },
      },
      orderBy: { relevance: "desc" },
    });

    const evidence = rows.map((row) => {
      const author = row.signal.author?.trim().toLowerCase() ?? "";
      const isContactNote =
        author.length > 0 &&
        (priorityNames.has(author) ||
          priorityNamesList.some(
            (n) => author.includes(n) || n.includes(author)
          ));
      const isWendy =
        row.signal.author?.toLowerCase().includes("wendy") ?? false;
      const isHighPriority = isContactNote || isWendy;

      return {
        id: row.id,
        excerpt: row.excerpt,
        relevance: row.relevance,
        isHighPriority,
        signal: {
          id: row.signal.id,
          source: row.signal.source,
          title: row.signal.title,
          author: row.signal.author,
          url: row.signal.url,
          signalDate: row.signal.signalDate.toISOString(),
          contentPreview:
            row.signal.content.length > 400
              ? `${row.signal.content.slice(0, 400)}…`
              : row.signal.content,
        },
      };
    });

    evidence.sort((a, b) => {
      if (a.isHighPriority !== b.isHighPriority) {
        return a.isHighPriority ? -1 : 1;
      }
      return b.relevance - a.relevance;
    });

    return NextResponse.json({
      metricName: kpi.metricName,
      evidence,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
    }
    console.error("[api/kpi/evidence]", error);
    return errorResponse("Failed to load evidence");
  }
}

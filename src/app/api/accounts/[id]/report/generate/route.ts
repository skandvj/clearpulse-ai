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
import { runAccountHealthScoring } from "@/lib/ai/scoreKPIHealth";
import { renderAccountReportToBuffer } from "@/lib/report/generateReport";
import { loadAccountReportData } from "@/lib/report/load-account-report-data";
import { uploadReportPdfToSupabase } from "@/lib/report/storage";

export const runtime = "nodejs";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildFileName(accountName: string, generatedAt: Date, version: number): string {
  const datePart = generatedAt.toISOString().slice(0, 10);
  const slug = slugify(accountName) || "account";
  return `${slug}-csm-account-overview-v${version}-${datePart}.pdf`;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(PERMISSIONS.DOWNLOAD_PDF_REPORT);

    const account = await prisma.clientAccount.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        csmId: true,
      },
    });

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    await requireAccountAccess(account.csmId);

    let reportData = await loadAccountReportData(
      params.id,
      user.name ?? user.email
    );

    if (!reportData) {
      return errorResponse("Account not found", 404);
    }

    const needsScoring = reportData.kpis.some(
      (kpi) => kpi.healthScore == null || !kpi.healthNarrative?.trim()
    );

    let warning: string | null = null;
    let scoringRefreshed = false;

    if (needsScoring) {
      try {
        await runAccountHealthScoring(params.id, user.id);
        scoringRefreshed = true;
        reportData = await loadAccountReportData(
          params.id,
          user.name ?? user.email
        );
      } catch (error) {
        warning =
          error instanceof Error
            ? `Report generated with existing KPI health because re-scoring failed: ${error.message}`
            : "Report generated with existing KPI health because re-scoring failed.";
      }
    }

    if (!reportData) {
      return errorResponse("Failed to load report data", 500);
    }

    const latestSnapshot = await prisma.reportSnapshot.findFirst({
      where: { accountId: params.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const version = (latestSnapshot?.version ?? 0) + 1;
    const generatedAt = new Date();
    const fileName = buildFileName(account.name, generatedAt, version);
    const pdfBuffer = await renderAccountReportToBuffer({
      ...reportData,
      generatedAt: generatedAt.toISOString(),
    });

    const storedFile = await uploadReportPdfToSupabase({
      fileName,
      buffer: pdfBuffer,
      pathPrefix: `account-reports/${params.id}`,
    });

    const snapshot = await prisma.reportSnapshot.create({
      data: {
        accountId: params.id,
        pdfUrl: storedFile.objectUrl,
        generatedBy: user.name ?? user.email,
        version,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "REPORT_GENERATED",
        entityType: "ClientAccount",
        entityId: params.id,
        metadata: {
          snapshotId: snapshot.id,
          version,
          fileName,
          storagePath: storedFile.path,
          scoringRefreshed,
        },
      },
    });

    return NextResponse.json({
      signedUrl: storedFile.signedUrl,
      fileName,
      snapshotId: snapshot.id,
      version,
      generatedAt: generatedAt.toISOString(),
      scoringRefreshed,
      warning,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
      if (error.message === "Supabase storage is not configured") {
        return errorResponse(error.message, 503);
      }
      return errorResponse(error.message);
    }

    return errorResponse("Failed to generate report");
  }
}

import { prisma } from "@/lib/db";
import {
  requireAccountAccess,
  requirePermission,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { runAccountHealthScoring } from "@/lib/ai/scoreKPIHealth";
import { renderAccountReportToBuffer } from "@/lib/report/generateReport";
import { loadAccountReportData } from "@/lib/report/load-account-report-data";
import { uploadReportPdfToSupabase } from "@/lib/report/storage";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAccountReportGeneratePostHandler } from "@/lib/api/account-report-generate-post";

export const runtime = "nodejs";

export const POST = createAccountReportGeneratePostHandler({
  requirePermission: () => requirePermission(PERMISSIONS.DOWNLOAD_PDF_REPORT),
  requireAccountAccess,
  getAccountById: (accountId) =>
    prisma.clientAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        name: true,
        csmId: true,
      },
    }),
  checkRateLimit,
  loadAccountReportData,
  runAccountHealthScoring,
  getLatestSnapshotVersion: async (accountId) => {
    const latestSnapshot = await prisma.reportSnapshot.findFirst({
      where: { accountId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    return latestSnapshot?.version ?? null;
  },
  renderAccountReportToBuffer,
  uploadReportPdfToSupabase,
  createReportSnapshot: (input) =>
    prisma.reportSnapshot.create({
      data: input,
      select: { id: true },
    }),
  createAuditLog: async (input) => {
    await prisma.auditLog.create({
      data: input,
    });
  },
});

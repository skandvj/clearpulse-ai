import { prisma } from "@/lib/db";
import {
  getAccessibleAccountWhere,
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
  getAccountById: async (accountId) => {
    const user = await requirePermission(PERMISSIONS.DOWNLOAD_PDF_REPORT);
    return prisma.clientAccount.findFirst({
      where: getAccessibleAccountWhere(user, accountId),
      select: {
        id: true,
        name: true,
        csmId: true,
      },
    });
  },
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
    const actor = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { organizationId: true },
    });

    await prisma.auditLog.create({
      data: {
        ...input,
        organizationId: actor?.organizationId ?? null,
      },
    });
  },
});

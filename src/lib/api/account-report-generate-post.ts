import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  applyRateLimitHeaders,
  buildRateLimitKey,
  rateLimitExceededResponse,
  type RateLimitResult,
} from "@/lib/rate-limit";
import type { AccountReportData } from "@/lib/report/load-account-report-data";
import { jsonError, jsonForbidden, jsonUnauthorized } from "./response-helpers";
import type { AccountRouteUser } from "./account-score-post";

interface ReportAccount {
  id: string;
  name: string;
  csmId: string | null;
}

interface UploadedReport {
  signedUrl: string;
  objectUrl: string;
  path: string;
}

interface ReportSnapshotRecord {
  id: string;
}

export interface AccountReportGeneratePostHandlerDeps {
  requirePermission: () => Promise<AccountRouteUser>;
  requireAccountAccess: (accountCsmId: string | null) => Promise<AccountRouteUser>;
  getAccountById: (accountId: string) => Promise<ReportAccount | null>;
  checkRateLimit: (input: {
    key: string;
    limit: number;
    windowSeconds: number;
  }) => Promise<RateLimitResult>;
  loadAccountReportData: (
    accountId: string,
    generatedBy: string
  ) => Promise<AccountReportData | null>;
  runAccountHealthScoring: (
    accountId: string,
    userId: string
  ) => Promise<unknown>;
  getLatestSnapshotVersion: (accountId: string) => Promise<number | null>;
  renderAccountReportToBuffer: (
    input: AccountReportData & { generatedAt: string }
  ) => Promise<Buffer>;
  uploadReportPdfToSupabase: (input: {
    fileName: string;
    buffer: Buffer;
    pathPrefix: string;
  }) => Promise<UploadedReport>;
  createReportSnapshot: (input: {
    accountId: string;
    pdfUrl: string;
    generatedBy: string;
    version: number;
  }) => Promise<ReportSnapshotRecord>;
  createAuditLog: (input: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Prisma.InputJsonValue;
  }) => Promise<void>;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildFileName(accountName: string, generatedAt: Date, version: number) {
  const datePart = generatedAt.toISOString().slice(0, 10);
  const slug = slugify(accountName) || "account";
  return `${slug}-csm-account-overview-v${version}-${datePart}.pdf`;
}

function mapAuthError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return jsonUnauthorized();
    }

    if (error.message.startsWith("Forbidden")) {
      return jsonForbidden(error.message);
    }

    if (error.message === "Supabase storage is not configured") {
      return jsonError(error.message, 503);
    }

    return jsonError(error.message);
  }

  return jsonError("Failed to generate report");
}

export function createAccountReportGeneratePostHandler(
  deps: AccountReportGeneratePostHandlerDeps
) {
  return async function POST(
    request: Request,
    { params }: { params: { id: string } }
  ) {
    try {
      const user = await deps.requirePermission();

      const account = await deps.getAccountById(params.id);
      if (!account) {
        return jsonError("Account not found", 404);
      }

      await deps.requireAccountAccess(account.csmId);

      const rateLimit = await deps.checkRateLimit({
        key: buildRateLimitKey({
          request,
          scope: "account-report-generate",
          userId: user.id,
          resource: params.id,
        }),
        limit: 10,
        windowSeconds: 60 * 60,
      });
      if (!rateLimit.allowed) {
        return rateLimitExceededResponse(
          rateLimit,
          "Too many report generation requests for this account. Please wait before generating another PDF."
        );
      }

      let reportData = await deps.loadAccountReportData(
        params.id,
        user.name ?? user.email
      );
      if (!reportData) {
        return jsonError("Account not found", 404);
      }

      const needsScoring = reportData.kpis.some(
        (kpi) => kpi.healthScore == null || !kpi.healthNarrative?.trim()
      );

      let warning: string | null = null;
      let scoringRefreshed = false;

      if (needsScoring) {
        try {
          await deps.runAccountHealthScoring(params.id, user.id);
          scoringRefreshed = true;
          reportData = await deps.loadAccountReportData(
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
        return jsonError("Failed to load report data", 500);
      }

      const latestVersion = await deps.getLatestSnapshotVersion(params.id);
      const version = (latestVersion ?? 0) + 1;
      const generatedAt = new Date();
      const fileName = buildFileName(account.name, generatedAt, version);
      const pdfBuffer = await deps.renderAccountReportToBuffer({
        ...reportData,
        generatedAt: generatedAt.toISOString(),
      });

      const storedFile = await deps.uploadReportPdfToSupabase({
        fileName,
        buffer: pdfBuffer,
        pathPrefix: `account-reports/${params.id}`,
      });

      const snapshot = await deps.createReportSnapshot({
        accountId: params.id,
        pdfUrl: storedFile.objectUrl,
        generatedBy: user.name ?? user.email,
        version,
      });

      await deps.createAuditLog({
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
      });

      const response = NextResponse.json({
        signedUrl: storedFile.signedUrl,
        fileName,
        snapshotId: snapshot.id,
        version,
        generatedAt: generatedAt.toISOString(),
        scoringRefreshed,
        warning,
      });
      return applyRateLimitHeaders(response, rateLimit);
    } catch (error) {
      return mapAuthError(error);
    }
  };
}

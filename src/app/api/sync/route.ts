import { NextRequest, NextResponse } from "next/server";
import { SignalSource } from "@prisma/client";
import {
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { processIngestionJob } from "@/lib/ingestion/service";

const ALL_SOURCES: SignalSource[] = [
  "SLACK",
  "FATHOM",
  "AM_MEETING",
  "VITALLY",
  "SALESFORCE",
  "PERSONAS",
  "SHAREPOINT",
  "JIRA",
  "GOOGLE_DRIVE",
];

const VALID_SOURCES = new Set<string>(ALL_SOURCES);

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.TRIGGER_SOURCE_SYNC);

    const body = await request.json();
    const { source, accountId } = body as {
      source?: string;
      accountId?: string;
    };

    if (!accountId || typeof accountId !== "string") {
      return errorResponse("accountId is required", 400);
    }

    if (source) {
      if (!VALID_SOURCES.has(source)) {
        return errorResponse(`Invalid source: ${source}`, 400);
      }

      const result = await processIngestionJob(
        source as SignalSource,
        accountId,
        user.id
      );

      return NextResponse.json({ results: [{ source, ...result }] });
    }

    const results = [];
    for (const src of ALL_SOURCES) {
      const result = await processIngestionJob(src, accountId, user.id);
      results.push({ source: src, ...result });
    }

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden"))
        return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to trigger sync");
  }
}

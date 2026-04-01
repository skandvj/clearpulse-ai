import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  extractDomainsFromEmails,
  findAccountForFathomAttendees,
  normalizeFathomMeeting,
  upsertFathomMeetingRecord,
  type FathomWebhookPayload,
} from "@/lib/integrations/fathom";
import { getIntegrationRuntimeValue } from "@/lib/integrations/settings";
import { logError, logWarn } from "@/lib/logging";

function parseWebhookSecret(secret: string): Buffer {
  const normalized = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  return Buffer.from(normalized, "base64");
}

function verifySignature(
  payload: string,
  webhookId: string | null,
  webhookTimestamp: string | null,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!webhookId || !webhookTimestamp || !signatureHeader) {
    return false;
  }

  const signedContent = `${webhookId}.${webhookTimestamp}.${payload}`;
  const expected = crypto
    .createHmac("sha256", parseWebhookSecret(secret))
    .update(signedContent)
    .digest("base64");

  const signatures = signatureHeader
    .split(/\s+/)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !value.startsWith("v"));

  return signatures.some((signature) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      );
    } catch {
      return false;
    }
  });
}

export async function POST(request: NextRequest) {
  const secret = await getIntegrationRuntimeValue(
    "FATHOM",
    "FATHOM_WEBHOOK_SECRET"
  );
  if (!secret) {
    logError(
      "webhook.fathom.unconfigured",
      new Error("FATHOM_WEBHOOK_SECRET not configured")
    );
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const webhookId = request.headers.get("webhook-id");
  const webhookTimestamp = request.headers.get("webhook-timestamp");
  const webhookSignature = request.headers.get("webhook-signature");

  if (
    !verifySignature(
      rawBody,
      webhookId,
      webhookTimestamp,
      webhookSignature,
      secret
    )
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: FathomWebhookPayload;

  try {
    body = JSON.parse(rawBody) as FathomWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const meetingPayload = normalizeFathomMeeting(body);
  if (!meetingPayload) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const attendees = meetingPayload.attendees ?? [];
  const attendeeEmails = attendees
    .map((attendee) => attendee.email?.trim().toLowerCase())
    .filter((value): value is string => !!value);

  if (attendeeEmails.length === 0) {
    logWarn("webhook.fathom.no_attendees", {});
    return NextResponse.json({ ok: true, skipped: true });
  }

  const domains = extractDomainsFromEmails(attendeeEmails);
  const account = await findAccountForFathomAttendees(attendees);

  if (!account) {
    logWarn("webhook.fathom.account_not_matched", {
      domains,
      recordingId: meetingPayload.id,
    });
    return NextResponse.json({ ok: true, matched: false });
  }

  let meetingRecordId: string | null = null;

  try {
    const meeting = await upsertFathomMeetingRecord(account.id, meetingPayload);
    meetingRecordId = meeting.id;
  } catch (error) {
    logError("webhook.fathom.meeting_upsert_failed", error, {
      accountId: account.id,
      meetingId: meetingPayload.id,
    });
  }

  let ingestionSummary:
    | {
        totalFetched: number;
        newSignals: number;
        duplicatesSkipped: number;
        errors: string[];
      }
    | null = null;

  try {
    const { processIngestionJob } = await import("@/lib/ingestion/service");
    const sinceCandidate = meetingPayload.date
      ? new Date(new Date(meetingPayload.date).getTime() - 24 * 60 * 60 * 1000)
      : null;
    const since =
      sinceCandidate && !Number.isNaN(sinceCandidate.getTime())
        ? sinceCandidate
        : undefined;
    ingestionSummary = await processIngestionJob(
      "FATHOM",
      account.id,
      "webhook:fathom",
      since
    );
  } catch (err) {
    logError("webhook.fathom.ingestion_failed", err, {
      accountId: account.id,
      meetingId: meetingPayload.id,
    });
  }

  return NextResponse.json({
    ok: true,
    accountId: account.id,
    meetingId: meetingRecordId,
    ingestion: ingestionSummary,
  });
}

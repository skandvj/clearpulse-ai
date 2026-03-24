import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  buildWebhookMeetingPayload,
  extractDomainsFromEmails,
  fetchFathomMeetingById,
  findAccountForFathomAttendees,
  upsertFathomMeetingRecord,
  type FathomAttendee,
} from "@/lib/integrations/fathom";
import { logError, logWarn } from "@/lib/logging";

function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export async function POST(request: NextRequest) {
  const secret = process.env.FATHOM_WEBHOOK_SECRET;
  if (!secret) {
    logError("webhook.fathom.unconfigured", new Error("FATHOM_WEBHOOK_SECRET not configured"));
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-fathom-signature");

  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: {
    event?: string;
    data?: {
      meeting_id?: string;
      title?: string;
      date?: string;
      duration_minutes?: number;
      attendees?: FathomAttendee[];
      recording_url?: string;
      summary?: string;
      transcript?: string;
      action_items?: string[];
    };
  };

  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.event !== "meeting.completed") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const attendees = body.data?.attendees ?? [];
  const attendeeEmails = attendees.map((a) => a.email).filter(Boolean);

  if (attendeeEmails.length === 0) {
    logWarn("webhook.fathom.no_attendees", {});
    return NextResponse.json({ ok: true, skipped: true });
  }

  const domains = extractDomainsFromEmails(attendeeEmails);
  const account = await findAccountForFathomAttendees(attendees);

  if (!account) {
    logWarn("webhook.fathom.account_not_matched", {
      domains,
    });
    return NextResponse.json({ ok: true, matched: false });
  }

  let meetingRecordId: string | null = null;
  let fetchedMeeting = buildWebhookMeetingPayload(body.data);

  if (body.data?.meeting_id) {
    try {
      fetchedMeeting = await fetchFathomMeetingById(body.data.meeting_id);
    } catch (error) {
      logWarn("webhook.fathom.lookup_failed", {
        meetingId: body.data.meeting_id,
        error:
          error instanceof Error ? error.message : "Meeting lookup failed",
      });
    }
  }

  if (fetchedMeeting) {
    try {
      const meeting = await upsertFathomMeetingRecord(account.id, fetchedMeeting);
      meetingRecordId = meeting.id;
    } catch (error) {
      logError("webhook.fathom.meeting_upsert_failed", error, {
        accountId: account.id,
        meetingId: fetchedMeeting.id,
      });
    }
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
    const sinceCandidate = fetchedMeeting?.date
      ? new Date(new Date(fetchedMeeting.date).getTime() - 24 * 60 * 60 * 1000)
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
      meetingId: fetchedMeeting?.id ?? null,
    });
  }

  return NextResponse.json({
    ok: true,
    accountId: account.id,
    meetingId: meetingRecordId,
    ingestion: ingestionSummary,
  });
}

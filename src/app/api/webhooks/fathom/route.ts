import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
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

function extractDomains(emails: string[]): string[] {
  const unique = Array.from(
    new Set(
      emails
        .map((e) => e.split("@")[1]?.toLowerCase())
        .filter((d): d is string => !!d)
    )
  );
  return unique;
}

export async function POST(request: NextRequest) {
  const secret = process.env.FATHOM_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook/fathom] FATHOM_WEBHOOK_SECRET not configured");
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
      attendees?: Array<{ email: string }>;
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

  const attendeeEmails =
    body.data?.attendees?.map((a) => a.email).filter(Boolean) ?? [];

  if (attendeeEmails.length === 0) {
    console.warn("[webhook/fathom] No attendee emails found");
    return NextResponse.json({ ok: true, skipped: true });
  }

  const domains = extractDomains(attendeeEmails);

  const account = await prisma.clientAccount.findFirst({
    where: { domain: { in: domains } },
    select: { id: true },
  });

  if (!account) {
    console.warn(
      `[webhook/fathom] No account matched for domains: ${domains.join(", ")}`
    );
    return NextResponse.json({ ok: true, matched: false });
  }

  try {
    const { processIngestionJob } = await import("@/lib/ingestion/service");
    await processIngestionJob("FATHOM", account.id, "webhook:fathom");
  } catch (err) {
    console.error("[webhook/fathom] Ingestion failed:", err);
  }

  return NextResponse.json({ ok: true, accountId: account.id });
}

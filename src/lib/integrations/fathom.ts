import { env } from "@/env";
import { prisma } from "@/lib/db";
import { getIntegrationRuntimeValue } from "@/lib/integrations/settings";

const FATHOM_API = "https://api.fathom.video/v1";

export interface FathomAttendee {
  email: string;
  name?: string | null;
}

export interface FathomMeetingPayload {
  id: string;
  title?: string | null;
  date?: string | null;
  duration_minutes?: number | null;
  attendees: FathomAttendee[];
  recording_url?: string | null;
  summary?: string | null;
  transcript?: string | null;
  action_items?: string[] | null;
}

function parseDate(value?: string | null): Date {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeParticipants(attendees: FathomAttendee[]): string[] {
  return attendees
    .map((attendee) => attendee.name?.trim() || attendee.email?.trim())
    .filter((value): value is string => !!value);
}

export function extractDomainsFromEmails(emails: string[]): string[] {
  return Array.from(
    new Set(
      emails
        .map((email) => email.split("@")[1]?.toLowerCase())
        .filter((value): value is string => !!value)
    )
  );
}

export function buildWebhookMeetingPayload(data?: {
  meeting_id?: string;
  title?: string;
  date?: string;
  duration_minutes?: number;
  attendees?: FathomAttendee[];
  recording_url?: string;
  summary?: string;
  transcript?: string;
  action_items?: string[];
}): FathomMeetingPayload | null {
  if (!data?.meeting_id) {
    return null;
  }

  return {
    id: data.meeting_id,
    title: data.title ?? null,
    date: data.date ?? null,
    duration_minutes: data.duration_minutes ?? null,
    attendees: data.attendees ?? [],
    recording_url: data.recording_url ?? null,
    summary: data.summary ?? null,
    transcript: data.transcript ?? null,
    action_items: data.action_items ?? null,
  };
}

export async function findAccountForFathomAttendees(attendees: FathomAttendee[]) {
  const attendeeEmails = attendees
    .map((attendee) => attendee.email?.trim().toLowerCase())
    .filter((value): value is string => !!value);

  if (attendeeEmails.length === 0) {
    return null;
  }

  const contactMatch = await prisma.contact.findFirst({
    where: {
      email: {
        in: attendeeEmails,
      },
    },
    select: {
      account: {
        select: {
          id: true,
          name: true,
          csmId: true,
          domain: true,
        },
      },
    },
  });

  if (contactMatch?.account) {
    return contactMatch.account;
  }

  const domains = extractDomainsFromEmails(attendeeEmails);

  if (domains.length === 0) {
    return null;
  }

  return prisma.clientAccount.findFirst({
    where: {
      domain: {
        in: domains,
      },
    },
    select: {
      id: true,
      name: true,
      csmId: true,
      domain: true,
    },
  });
}

export async function fetchFathomMeetingById(
  meetingId: string
): Promise<FathomMeetingPayload> {
  const apiKey =
    (await getIntegrationRuntimeValue("FATHOM", "FATHOM_API_KEY")) ??
    env.FATHOM_API_KEY;

  if (!apiKey) {
    throw new Error("FATHOM_API_KEY is not configured");
  }

  const response = await fetch(
    `${FATHOM_API}/meetings/${encodeURIComponent(meetingId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Fathom meeting lookup failed: ${response.status} ${response.statusText}`
    );
  }

  const body = (await response.json()) as
    | FathomMeetingPayload
    | { meeting: FathomMeetingPayload };

  return "meeting" in body ? body.meeting : body;
}

export async function upsertFathomMeetingRecord(
  accountId: string,
  meeting: FathomMeetingPayload
) {
  const meetingDate = parseDate(meeting.date);
  const participants = normalizeParticipants(meeting.attendees);

  return prisma.meeting.upsert({
    where: {
      fathomId: meeting.id,
    },
    create: {
      fathomId: meeting.id,
      accountId,
      title: meeting.title?.trim() || "Fathom Meeting",
      recordingUrl: meeting.recording_url ?? null,
      transcriptRaw: meeting.transcript ?? null,
      summaryAI: meeting.summary ?? null,
      duration: meeting.duration_minutes ?? null,
      meetingDate,
      participants,
    },
    update: {
      accountId,
      title: meeting.title?.trim() || "Fathom Meeting",
      recordingUrl: meeting.recording_url ?? null,
      transcriptRaw: meeting.transcript ?? null,
      summaryAI: meeting.summary ?? null,
      duration: meeting.duration_minutes ?? null,
      meetingDate,
      participants,
    },
  });
}

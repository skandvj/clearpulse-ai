import { prisma } from "@/lib/db";

export interface FathomAttendee {
  email: string;
  name?: string | null;
  email_domain?: string | null;
  is_external?: boolean | null;
}

interface FathomTranscriptEntry {
  text?: string | null;
  timestamp?: string | null;
  speaker?: {
    display_name?: string | null;
    matched_calendar_invitee_email?: string | null;
  } | null;
}

interface FathomActionItem {
  description?: string | null;
  recording_timestamp?: string | null;
  recording_playback_url?: string | null;
}

interface FathomSummary {
  markdown_formatted?: string | null;
}

export interface FathomMeetingPayload {
  id: string;
  title?: string | null;
  meetingTitle?: string | null;
  date?: string | null;
  attendees: FathomAttendee[];
  recordingUrl?: string | null;
  shareUrl?: string | null;
  summary?: string | null;
  transcript?: string | null;
  actionItems?: string[] | null;
}

export interface FathomWebhookPayload {
  recording_id?: number | string;
  title?: string | null;
  meeting_title?: string | null;
  url?: string | null;
  share_url?: string | null;
  created_at?: string | null;
  scheduled_start_time?: string | null;
  recording_start_time?: string | null;
  calendar_invitees?: FathomAttendee[] | null;
  transcript?: FathomTranscriptEntry[] | string | null;
  default_summary?: FathomSummary | null;
  action_items?: FathomActionItem[] | string[] | null;
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

function normalizeTranscript(
  transcript?: FathomTranscriptEntry[] | string | null
): string | null {
  if (!transcript) return null;
  if (typeof transcript === "string") {
    const value = transcript.trim();
    return value.length > 0 ? value : null;
  }

  const parts = transcript
    .map((entry) => {
      const text = entry.text?.trim();
      if (!text) return null;
      const speaker = entry.speaker?.display_name?.trim();
      const timestamp = entry.timestamp?.trim();
      const prefix = [timestamp, speaker].filter(Boolean).join(" ");
      return prefix ? `[${prefix}] ${text}` : text;
    })
    .filter((value): value is string => !!value);

  return parts.length > 0 ? parts.join("\n") : null;
}

function normalizeSummary(summary?: FathomSummary | string | null): string | null {
  if (!summary) return null;
  if (typeof summary === "string") {
    const value = summary.trim();
    return value.length > 0 ? value : null;
  }

  const value = summary.markdown_formatted?.trim();
  return value && value.length > 0 ? value : null;
}

function normalizeActionItems(
  actionItems?: FathomActionItem[] | string[] | null
): string[] | null {
  if (!actionItems || actionItems.length === 0) return null;

  const values = actionItems
    .map((item) => {
      if (typeof item === "string") {
        const value = item.trim();
        return value.length > 0 ? value : null;
      }

      const description = item.description?.trim();
      if (!description) return null;
      const timestamp = item.recording_timestamp?.trim();
      return timestamp ? `${description} (${timestamp})` : description;
    })
    .filter((value): value is string => !!value);

  return values.length > 0 ? values : null;
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

export function normalizeFathomMeeting(
  data?: FathomWebhookPayload | null
): FathomMeetingPayload | null {
  if (!data?.recording_id) {
    return null;
  }

  return {
    id: String(data.recording_id),
    title: data.meeting_title ?? data.title ?? null,
    meetingTitle: data.meeting_title ?? null,
    date:
      data.recording_start_time ??
      data.scheduled_start_time ??
      data.created_at ??
      null,
    attendees: data.calendar_invitees ?? [],
    recordingUrl: data.url ?? null,
    shareUrl: data.share_url ?? null,
    summary: normalizeSummary(data.default_summary ?? null),
    transcript: normalizeTranscript(data.transcript ?? null),
    actionItems: normalizeActionItems(data.action_items ?? null),
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
      recordingUrl: meeting.recordingUrl ?? meeting.shareUrl ?? null,
      transcriptRaw: meeting.transcript ?? null,
      summaryAI: meeting.summary ?? null,
      duration: null,
      meetingDate,
      participants,
    },
    update: {
      accountId,
      title: meeting.title?.trim() || "Fathom Meeting",
      recordingUrl: meeting.recordingUrl ?? meeting.shareUrl ?? null,
      transcriptRaw: meeting.transcript ?? null,
      summaryAI: meeting.summary ?? null,
      duration: null,
      meetingDate,
      participants,
    },
  });
}

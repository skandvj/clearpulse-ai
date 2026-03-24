import { SignalSource } from "@prisma/client";
import { SourceAdapter, RawSignalInput } from "@/lib/ingestion/types";
import { prisma } from "@/lib/db";

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  organizer?: { email: string; displayName?: string };
  htmlLink?: string;
  conferenceData?: {
    entryPoints?: { uri?: string; entryPointType?: string }[];
  };
}

interface GoogleCalendarListResponse {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export class AMMeetingsAdapter implements SourceAdapter {
  source = SignalSource.AM_MEETING;

  async fetchSignals(
    accountId: string,
    since?: Date,
  ): Promise<RawSignalInput[]> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return this.generateMockSignals(accountId);
    }

    try {
      const account = await prisma.clientAccount.findUniqueOrThrow({
        where: { id: accountId },
        include: { contacts: true },
      });

      const accessToken = await this.getAccessToken(
        clientId,
        clientSecret,
        refreshToken,
      );

      const domain = account.domain;
      const contactEmails = new Set(
        account.contacts
          .map((c) => c.email?.toLowerCase())
          .filter(Boolean) as string[],
      );

      const timeMin = (
        since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).toISOString();
      const timeMax = new Date().toISOString();

      const signals: RawSignalInput[] = [];
      let pageToken: string | undefined;

      do {
        const params = new URLSearchParams({
          timeMin,
          timeMax,
          maxResults: "100",
          singleEvents: "true",
          orderBy: "startTime",
          ...(pageToken ? { pageToken } : {}),
        });

        const res = await fetch(
          `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        if (!res.ok) {
          throw new Error(
            `Google Calendar API error: ${res.status} ${res.statusText}`,
          );
        }

        const data = (await res.json()) as GoogleCalendarListResponse;

        for (const event of data.items) {
          const attendees = event.attendees ?? [];
          const hasAccountAttendee = attendees.some((a) => {
            const email = a.email.toLowerCase();
            if (contactEmails.has(email)) return true;
            if (domain && email.endsWith(`@${domain}`)) return true;
            return false;
          });

          if (!hasAccountAttendee) continue;

          const externalAttendees = attendees.filter((a) => {
            const email = a.email.toLowerCase();
            if (domain) return email.endsWith(`@${domain}`);
            return contactEmails.has(email);
          });

          const startTime = event.start.dateTime || event.start.date;
          if (!startTime) continue;

          const contentParts: string[] = [];
          contentParts.push(
            `Meeting: ${event.summary || "Untitled"}`,
          );
          if (externalAttendees.length) {
            contentParts.push(
              `External attendees: ${externalAttendees.map((a) => a.displayName || a.email).join(", ")}`,
            );
          }
          if (event.description) {
            contentParts.push(`\nDescription:\n${event.description}`);
          }

          signals.push({
            externalId: `gcal-${event.id}`,
            title: event.summary || "Calendar Meeting",
            content: contentParts.join("\n"),
            author: event.organizer?.displayName || event.organizer?.email,
            url: event.htmlLink,
            signalDate: new Date(startTime),
          });
        }

        pageToken = data.nextPageToken;
      } while (pageToken);

      return signals;
    } catch (error) {
      console.error("[AMMeetingsAdapter] Error fetching signals:", error);
      throw error;
    }
  }

  private async getAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<string> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to refresh Google token: ${res.status}`);
    }

    const data = (await res.json()) as GoogleTokenResponse;
    return data.access_token;
  }

  private async generateMockSignals(
    accountId: string,
  ): Promise<RawSignalInput[]> {
    const mockMeetings = [
      {
        title: "Weekly Check-in: Account Review",
        content: `Meeting: Weekly Check-in: Account Review
External attendees: Sarah Thompson (VP Customer Success), Michael Lee (IT Director)

Discussed ongoing platform adoption metrics. Active user count rose to 340 out of 400 licensed seats. Michael raised a concern about API latency during peak hours — averaging 450ms vs. the SLA target of 200ms. Agreed to escalate to engineering and provide a root cause analysis by Friday. Sarah mentioned the CEO is presenting platform ROI to the board next month and needs a polished report.`,
        author: "Jordan Blake",
      },
      {
        title: "Strategy Session: Expansion Planning",
        content: `Meeting: Strategy Session: Expansion Planning
External attendees: Patricia Nguyen (COO), Robert Chen (Head of Product)

Deep-dive on expansion opportunities. Patricia confirmed budget approval for adding 150 seats in Q2 for the operations team. Robert wants a custom integration with their internal ERP system — scoping exercise needed. Discussed timeline: kick-off for new department onboarding in April, full rollout by June. Identified need for dedicated implementation manager.`,
        author: "Alex Foster",
      },
      {
        title: "Escalation Call: Data Migration Issues",
        content: `Meeting: Escalation Call: Data Migration Issues
External attendees: David Kim (Engineering Manager), Lisa Park (Data Analyst)

Urgent call regarding data migration failures during their legacy system cutover. 15% of historical records failed validation — mostly date format mismatches and duplicate keys. David expressed frustration with the lack of detailed error logs. Agreed to provide: (1) enhanced error export with row-level details by EOD, (2) dedicated migration support engineer for next 2 weeks, (3) daily standups until migration completes.`,
        author: "Chris Morgan",
      },
    ];

    return mockMeetings.map((m, i) => ({
      externalId: `mock-am-meeting-${accountId}-${i}`,
      title: m.title,
      content: m.content,
      author: m.author,
      signalDate: randomDateWithinLast30Days(),
    }));
  }
}

function randomDateWithinLast30Days(): Date {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  return new Date(thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo));
}

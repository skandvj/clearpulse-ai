import { SignalSource } from "@prisma/client";
import { SourceAdapter, RawSignalInput } from "@/lib/ingestion/types";
import { prisma } from "@/lib/db";
import { upsertFathomMeetingRecord } from "@/lib/integrations/fathom";
import { getIntegrationRuntimeValues } from "@/lib/integrations/settings";
import { logError } from "@/lib/logging";
import { resolveMockFallback } from "@/lib/sources/mock-fallback";

interface FathomMeeting {
  id: string;
  title: string;
  date: string;
  duration_minutes: number;
  attendees: { email: string; name: string }[];
  recording_url?: string;
  summary?: string;
  transcript?: string;
  action_items?: string[];
}

interface FathomListResponse {
  meetings: FathomMeeting[];
  has_more: boolean;
  next_cursor?: string;
}

const FATHOM_API = "https://api.fathom.video/v1";

export class FathomAdapter implements SourceAdapter {
  source = SignalSource.FATHOM;

  async fetchSignals(
    accountId: string,
    since?: Date,
  ): Promise<RawSignalInput[]> {
    const config = await getIntegrationRuntimeValues(this.source, [
      "FATHOM_API_KEY",
    ]);

    const mockSignals = await resolveMockFallback({
      source: this.source,
      accountId,
      requiredEnv: ["FATHOM_API_KEY"],
      resolvedValues: config,
      createMockSignals: () => this.generateMockSignals(accountId),
    });
    if (mockSignals) return mockSignals;

    const apiKey = config.FATHOM_API_KEY!;

    try {
      const account = await prisma.clientAccount.findUniqueOrThrow({
        where: { id: accountId },
        include: { contacts: true },
      });

      const domain = account.domain;
      const contactEmails = new Set(
        account.contacts
          .map((c) => c.email?.toLowerCase())
          .filter(Boolean) as string[],
      );

      const afterDate = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const signals: RawSignalInput[] = [];
      let cursor: string | undefined;

      do {
        const params = new URLSearchParams({
          after: afterDate.toISOString(),
          limit: "50",
          ...(cursor ? { cursor } : {}),
        });

        const res = await fetch(`${FATHOM_API}/meetings?${params}`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(
            `Fathom API error: ${res.status} ${res.statusText}`,
          );
        }

        const data = (await res.json()) as FathomListResponse;

        for (const meeting of data.meetings) {
          const isAccountMeeting = meeting.attendees.some((a) => {
            const email = a.email.toLowerCase();
            if (contactEmails.has(email)) return true;
            if (domain && email.endsWith(`@${domain}`)) return true;
            return false;
          });

          if (!isAccountMeeting) continue;

          await upsertFathomMeetingRecord(account.id, meeting);

          const contentParts: string[] = [];
          if (meeting.summary) {
            contentParts.push(`## AI Summary\n${meeting.summary}`);
          }
          if (meeting.action_items?.length) {
            contentParts.push(
              `## Action Items\n${meeting.action_items.map((a) => `- ${a}`).join("\n")}`,
            );
          }
          if (meeting.transcript) {
            const truncated =
              meeting.transcript.length > 3000
                ? meeting.transcript.slice(0, 3000) + "\n[transcript truncated]"
                : meeting.transcript;
            contentParts.push(`## Transcript\n${truncated}`);
          }

          const externalAttendees = meeting.attendees.filter((a) => {
            if (domain) return a.email.toLowerCase().endsWith(`@${domain}`);
            return contactEmails.has(a.email.toLowerCase());
          });

          signals.push({
            externalId: `fathom-${meeting.id}`,
            title: meeting.title,
            content:
              contentParts.join("\n\n") || "Meeting recorded — no summary available.",
            author: externalAttendees.map((a) => a.name).join(", ") || undefined,
            url: meeting.recording_url,
            signalDate: new Date(meeting.date),
          });
        }

        cursor = data.has_more ? data.next_cursor : undefined;
      } while (cursor);

      return signals;
    } catch (error) {
      logError("adapter.fetch_failed", error, {
        adapter: "FathomAdapter",
        source: this.source,
        accountId,
      });
      throw error;
    }
  }

  private async generateMockSignals(
    accountId: string,
  ): Promise<RawSignalInput[]> {
    const mockMeetings = [
      {
        title: "Q1 Quarterly Business Review",
        content: `## AI Summary
Reviewed Q1 performance metrics with the customer's leadership team. Key achievements: 35% improvement in ticket deflection rate, successful launch of self-service portal. Customer expressed strong satisfaction with the product roadmap. Discussed expansion to the APAC region — VP of Customer Success requested a timeline for multi-language support.

## Action Items
- Send updated pricing proposal for APAC expansion by March 15
- Schedule technical deep-dive on localization capabilities
- Share Q1 ROI report with their CFO
- Follow up on SSO integration timeline`,
        author: "Jennifer Martinez, Tom Bradley",
      },
      {
        title: "Feature Demo: Advanced Analytics Module",
        content: `## AI Summary
Walked through the new analytics dashboard with the product team. They were particularly interested in the cohort analysis and predictive churn features. Their data team had questions about API rate limits for bulk data export. One concern raised: current reporting doesn't support custom fiscal year calendars, which is a requirement for their finance team.

## Action Items
- File product request for custom fiscal year calendar support
- Share API documentation for bulk export endpoints
- Provide sandbox access for their data engineering team`,
        author: "Lisa Wong",
      },
      {
        title: "Onboarding Kickoff: Marketing Department",
        content: `## AI Summary
Kicked off onboarding for the marketing department (45 new users). Reviewed the implementation timeline — targeting full rollout by end of month. Their team lead is concerned about data migration from their legacy system. Agreed on bi-weekly check-ins during the onboarding phase. Training sessions scheduled for next Tuesday and Thursday.

## Action Items
- Send data migration guide and CSV templates
- Set up sandbox environment for marketing team
- Schedule training sessions (Tues 2pm, Thurs 10am)
- Create shared Slack channel for onboarding support`,
        author: "Kevin Patel, Maria Santos",
      },
    ];

    return mockMeetings.map((m, i) => ({
      externalId: `mock-fathom-${accountId}-${i}`,
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

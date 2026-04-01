import { SignalSource } from "@prisma/client";
import { SourceAdapter, RawSignalInput } from "@/lib/ingestion/types";
import { prisma } from "@/lib/db";
import {
  normalizeFathomMeeting,
  upsertFathomMeetingRecord,
  type FathomWebhookPayload,
} from "@/lib/integrations/fathom";
import { getIntegrationRuntimeValues } from "@/lib/integrations/settings";
import { logError } from "@/lib/logging";
import { resolveMockFallback } from "@/lib/sources/mock-fallback";

interface FathomListResponse {
  items: FathomWebhookPayload[];
  next_cursor?: string | null;
}

const FATHOM_API = "https://api.fathom.ai/external/v1";

export class FathomAdapter implements SourceAdapter {
  source = SignalSource.FATHOM;

  async fetchSignals(
    accountId: string,
    since?: Date
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

      const domain = account.domain?.trim().toLowerCase() ?? null;
      const contactEmails = Array.from(
        new Set(
          account.contacts
            .map((contact) => contact.email?.trim().toLowerCase())
            .filter((value): value is string => !!value)
        )
      );

      const afterDate =
        since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const signals: RawSignalInput[] = [];
      let cursor: string | undefined;

      do {
        const params = new URLSearchParams({
          created_after: afterDate.toISOString(),
          limit: "50",
          include_transcript: "true",
          include_summary: "true",
          include_action_items: "true",
          ...(cursor ? { cursor } : {}),
        });

        if (domain) {
          params.append("calendar_invitees_domains[]", domain);
        }

        for (const email of contactEmails) {
          params.append("calendar_invitees[]", email);
        }

        const res = await fetch(`${FATHOM_API}/meetings?${params.toString()}`, {
          headers: {
            "X-Api-Key": apiKey,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(
            `Fathom API error: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ""}`
          );
        }

        const data = (await res.json()) as FathomListResponse;

        for (const item of data.items ?? []) {
          const meeting = normalizeFathomMeeting(item);
          if (!meeting) continue;

          const isAccountMeeting = meeting.attendees.some((attendee) => {
            const email = attendee.email?.trim().toLowerCase();
            if (!email) return false;
            if (contactEmails.includes(email)) return true;
            if (domain && email.endsWith(`@${domain}`)) return true;
            return false;
          });

          if (!isAccountMeeting) continue;

          await upsertFathomMeetingRecord(account.id, meeting);

          const contentParts: string[] = [];
          if (meeting.summary) {
            contentParts.push(`## AI Summary\n${meeting.summary}`);
          }
          if (meeting.actionItems?.length) {
            contentParts.push(
              `## Action Items\n${meeting.actionItems.map((value) => `- ${value}`).join("\n")}`
            );
          }
          if (meeting.transcript) {
            const truncated =
              meeting.transcript.length > 6000
                ? `${meeting.transcript.slice(0, 6000)}\n[transcript truncated]`
                : meeting.transcript;
            contentParts.push(`## Transcript\n${truncated}`);
          }

          const matchingAttendees = meeting.attendees.filter((attendee) => {
            const email = attendee.email?.trim().toLowerCase();
            if (!email) return false;
            if (contactEmails.includes(email)) return true;
            return !!domain && email.endsWith(`@${domain}`);
          });

          signals.push({
            externalId: `fathom-${meeting.id}`,
            title: meeting.title ?? "Fathom Meeting",
            content:
              contentParts.join("\n\n") || "Meeting recorded — no summary available.",
            author:
              matchingAttendees
                .map((attendee) => attendee.name?.trim() || attendee.email)
                .filter((value): value is string => !!value)
                .join(", ") || undefined,
            url: meeting.recordingUrl ?? meeting.shareUrl ?? undefined,
            signalDate: new Date(meeting.date ?? afterDate.toISOString()),
          });
        }

        cursor = data.next_cursor ?? undefined;
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
    accountId: string
  ): Promise<RawSignalInput[]> {
    const mockMeetings = [
      {
        title: "Q1 Quarterly Business Review",
        content: `## AI Summary
Reviewed Q1 performance metrics with the customer's leadership team. Key achievements: 35% improvement in ticket deflection rate, successful launch of self-service portal. Customer expressed strong satisfaction with the product roadmap. Discussed expansion to the APAC region and requested a timeline for multi-language support.

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
Walked through the new analytics dashboard with the product team. They were particularly interested in cohort analysis and predictive churn features. Their data team had questions about API rate limits for bulk data export. One concern raised: current reporting doesn't support custom fiscal year calendars, which is a requirement for their finance team.

## Action Items
- File product request for custom fiscal year calendar support
- Share API documentation for bulk export endpoints
- Provide sandbox access for their data engineering team`,
        author: "Lisa Wong",
      },
      {
        title: "Onboarding Kickoff: Marketing Department",
        content: `## AI Summary
Kicked off onboarding for the marketing department (45 new users). Reviewed the implementation timeline and targeted full rollout by end of month. Their team lead is concerned about data migration from the legacy system. Agreed on bi-weekly check-ins during the onboarding phase.

## Action Items
- Send data migration guide and CSV templates
- Set up sandbox environment for marketing team
- Schedule training sessions
- Create shared Slack channel for onboarding support`,
        author: "Kevin Patel, Maria Santos",
      },
    ];

    return mockMeetings.map((meeting, index) => ({
      externalId: `mock-fathom-${accountId}-${index}`,
      title: meeting.title,
      content: meeting.content,
      author: meeting.author,
      signalDate: randomDateWithinLast30Days(),
    }));
  }
}

function randomDateWithinLast30Days(): Date {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  return new Date(thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo));
}

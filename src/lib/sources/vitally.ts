import { SignalSource } from "@prisma/client";
import { SourceAdapter, RawSignalInput } from "@/lib/ingestion/types";
import { prisma } from "@/lib/db";
import { logError, logWarn } from "@/lib/logging";
import { resolveMockFallback } from "@/lib/sources/mock-fallback";

interface VitallyNote {
  id: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  author?: { name: string; email: string };
  accountId: string;
  category?: string;
}

interface VitallyNPSSurvey {
  id: string;
  score: number;
  feedback?: string;
  respondent: { name: string; email: string };
  createdAt: string;
  accountId: string;
}

interface VitallyNotesResponse {
  results: VitallyNote[];
  next?: string;
}

interface VitallyNPSResponse {
  results: VitallyNPSSurvey[];
  next?: string;
}

const VITALLY_API = "https://rest.vitally.io/resources";

export class VitallyAdapter implements SourceAdapter {
  source = SignalSource.VITALLY;

  async fetchSignals(
    accountId: string,
    since?: Date,
  ): Promise<RawSignalInput[]> {
    const mockSignals = await resolveMockFallback({
      source: this.source,
      accountId,
      requiredEnv: ["VITALLY_API_KEY"],
      createMockSignals: () => this.generateMockSignals(accountId),
    });
    if (mockSignals) return mockSignals;

    const apiKey = process.env.VITALLY_API_KEY!;

    try {
      const account = await prisma.clientAccount.findUniqueOrThrow({
        where: { id: accountId },
      });

      if (!account.vitallyAccountId) {
        logWarn("adapter.vitally.missing_account_id", {
          accountId,
          accountName: account.name,
        });
        return [];
      }

      const sinceDate = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };

      const signals: RawSignalInput[] = [];

      const notes = await this.fetchNotes(
        headers,
        account.vitallyAccountId,
        sinceDate,
      );
      for (const note of notes) {
        signals.push({
          externalId: `vitally-note-${note.id}`,
          title: note.category
            ? `${note.category} Note`
            : "CSM Note",
          content: note.note,
          author: note.author?.name,
          url: `https://app.vitally.io/accounts/${account.vitallyAccountId}`,
          signalDate: new Date(note.createdAt),
        });
      }

      const npsScores = await this.fetchNPS(
        headers,
        account.vitallyAccountId,
        sinceDate,
      );
      for (const nps of npsScores) {
        const content = [
          `NPS Score: ${nps.score}/10`,
          nps.feedback ? `Feedback: ${nps.feedback}` : null,
          `Respondent: ${nps.respondent.name} (${nps.respondent.email})`,
        ]
          .filter(Boolean)
          .join("\n");

        signals.push({
          externalId: `vitally-nps-${nps.id}`,
          title: `NPS Survey Response: ${nps.score}/10`,
          content,
          author: nps.respondent.name,
          url: `https://app.vitally.io/accounts/${account.vitallyAccountId}`,
          signalDate: new Date(nps.createdAt),
        });
      }

      return signals;
    } catch (error) {
      logError("adapter.fetch_failed", error, {
        adapter: "VitallyAdapter",
        source: this.source,
        accountId,
      });
      throw error;
    }
  }

  private async fetchNotes(
    headers: Record<string, string>,
    vitallyAccountId: string,
    since: Date,
  ): Promise<VitallyNote[]> {
    const allNotes: VitallyNote[] = [];
    let nextUrl: string | undefined = `${VITALLY_API}/notes?accountId=${vitallyAccountId}&createdAt[gte]=${since.toISOString()}&limit=100`;

    while (nextUrl) {
      const res = await fetch(nextUrl, { headers });
      if (!res.ok) {
        throw new Error(`Vitally notes API error: ${res.status}`);
      }
      const data = (await res.json()) as VitallyNotesResponse;
      allNotes.push(...data.results);
      nextUrl = data.next || undefined;
    }
    return allNotes;
  }

  private async fetchNPS(
    headers: Record<string, string>,
    vitallyAccountId: string,
    since: Date,
  ): Promise<VitallyNPSSurvey[]> {
    const allScores: VitallyNPSSurvey[] = [];
    let nextUrl: string | undefined = `${VITALLY_API}/nps_responses?accountId=${vitallyAccountId}&createdAt[gte]=${since.toISOString()}&limit=100`;

    while (nextUrl) {
      const res = await fetch(nextUrl, { headers });
      if (!res.ok) {
        throw new Error(`Vitally NPS API error: ${res.status}`);
      }
      const data = (await res.json()) as VitallyNPSResponse;
      allScores.push(...data.results);
      nextUrl = data.next || undefined;
    }
    return allScores;
  }

  private async generateMockSignals(
    accountId: string,
  ): Promise<RawSignalInput[]> {
    const mockSignals = [
      {
        title: "CSM Note: Quarterly Check-in Summary",
        content:
          "Completed quarterly check-in with the account champion. Overall sentiment is positive — they highlighted the 28% reduction in manual workflows since adopting our automation module. Key concern: their legal team needs SOC 2 Type II documentation before approving the enterprise-wide rollout. Timeline pressure is real — they want to present to the board by end of Q2.",
        author: "Amanda Torres",
      },
      {
        title: "NPS Survey Response: 9/10",
        content:
          'NPS Score: 9/10\nFeedback: "The platform has transformed how our CS team operates. The AI-powered insights save us 5+ hours per week. Only knock is that the mobile experience could be better — our field team uses tablets extensively."\nRespondent: Chris Donovan (chris.donovan@acme.com)',
        author: "Chris Donovan",
      },
      {
        title: "Health Assessment Note",
        content:
          "Updated account health to AT_RISK. Key factors: (1) Primary champion Sarah left the company last week, new contact TBD. (2) Competitor demo was scheduled by their procurement team. (3) Usage dropped 15% month-over-month. Immediate action plan: schedule intro with new stakeholder, prepare competitive battle card, engage exec sponsor for relationship continuity.",
        author: "Ryan Mitchell",
      },
      {
        title: "NPS Survey Response: 6/10",
        content:
          'NPS Score: 6/10\nFeedback: "The core product is solid but implementation took longer than promised and we\'re still waiting on two integrations that were part of our original SOW. Support response times have also been inconsistent."\nRespondent: Diana Kessler (diana.kessler@acme.com)',
        author: "Diana Kessler",
      },
    ];

    return mockSignals.map((s, i) => ({
      externalId: `mock-vitally-${accountId}-${i}`,
      title: s.title,
      content: s.content,
      author: s.author,
      signalDate: randomDateWithinLast30Days(),
    }));
  }
}

function randomDateWithinLast30Days(): Date {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  return new Date(thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo));
}

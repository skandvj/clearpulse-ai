import { SignalSource } from "@prisma/client";
import { SourceAdapter, RawSignalInput } from "@/lib/ingestion/types";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/logging";
import { resolveMockFallback } from "@/lib/sources/mock-fallback";

interface PersonaProfile {
  id: string;
  accountId: string;
  personaType: string;
  title: string;
  attributes: Record<string, string | number | boolean>;
  segments: string[];
  lastUpdated: string;
  createdAt: string;
}

interface PersonaSegmentUpdate {
  id: string;
  accountId: string;
  segmentName: string;
  previousSegment?: string;
  reason: string;
  updatedAt: string;
}

interface PersonaProfilesResponse {
  profiles: PersonaProfile[];
  total: number;
  page: number;
  pageSize: number;
}

interface PersonaSegmentsResponse {
  updates: PersonaSegmentUpdate[];
  total: number;
}

export class PersonasAdapter implements SourceAdapter {
  source = SignalSource.PERSONAS;

  async fetchSignals(
    accountId: string,
    since?: Date,
  ): Promise<RawSignalInput[]> {
    const apiUrl = process.env.PERSONAS_API_URL;
    const apiKey = process.env.PERSONAS_API_KEY;

    const mockSignals = await resolveMockFallback({
      source: this.source,
      accountId,
      requiredEnv: ["PERSONAS_API_URL", "PERSONAS_API_KEY"],
      createMockSignals: () => this.generateMockSignals(accountId),
    });
    if (mockSignals) return mockSignals;

    try {
      const account = await prisma.clientAccount.findUniqueOrThrow({
        where: { id: accountId },
      });

      const sinceDate = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };

      const signals: RawSignalInput[] = [];

      const profilesRes = await fetch(
        `${apiUrl}/api/v1/profiles?accountDomain=${encodeURIComponent(account.domain || account.name)}&updatedSince=${sinceDate.toISOString()}`,
        { headers },
      );

      if (profilesRes.ok) {
        const profilesData =
          (await profilesRes.json()) as PersonaProfilesResponse;

        for (const profile of profilesData.profiles) {
          const attrLines = Object.entries(profile.attributes)
            .map(([k, v]) => `- ${k}: ${v}`)
            .join("\n");

          signals.push({
            externalId: `personas-profile-${profile.id}`,
            title: `Persona Profile: ${profile.title}`,
            content: [
              `Persona Type: ${profile.personaType}`,
              `Segments: ${profile.segments.join(", ")}`,
              attrLines ? `\nAttributes:\n${attrLines}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            signalDate: new Date(profile.lastUpdated),
          });
        }
      }

      const segmentsRes = await fetch(
        `${apiUrl}/api/v1/segment-updates?accountDomain=${encodeURIComponent(account.domain || account.name)}&since=${sinceDate.toISOString()}`,
        { headers },
      );

      if (segmentsRes.ok) {
        const segmentsData =
          (await segmentsRes.json()) as PersonaSegmentsResponse;

        for (const update of segmentsData.updates) {
          signals.push({
            externalId: `personas-segment-${update.id}`,
            title: `Segment Update: ${update.segmentName}`,
            content: [
              `New Segment: ${update.segmentName}`,
              update.previousSegment
                ? `Previous Segment: ${update.previousSegment}`
                : null,
              `Reason: ${update.reason}`,
            ]
              .filter(Boolean)
              .join("\n"),
            signalDate: new Date(update.updatedAt),
          });
        }
      }

      return signals;
    } catch (error) {
      logError("adapter.fetch_failed", error, {
        adapter: "PersonasAdapter",
        source: this.source,
        accountId,
      });
      throw error;
    }
  }

  private async generateMockSignals(
    accountId: string,
  ): Promise<RawSignalInput[]> {
    const mockSignals = [
      {
        title: "Persona Profile: Power User Champion",
        content: `Persona Type: Champion
Segments: Enterprise, High-Engagement, Product-Led Growth

Attributes:
- loginFrequency: Daily
- featureAdoptionScore: 92
- teamSize: 45
- primaryUseCase: Workflow Automation
- npsLikelihood: Promoter
- integrationCount: 7
- avgSessionDuration: 42 minutes
- contentCreated: 230 items this quarter`,
      },
      {
        title: "Segment Update: Moved to Expansion-Ready",
        content: `New Segment: Expansion-Ready
Previous Segment: Growth
Reason: Account has exceeded 90% seat utilization for 3 consecutive months, power user count increased by 60%, and 4 new departments have begun using the platform organically. Product usage patterns indicate strong fit for Advanced Analytics and Enterprise Security add-ons.`,
      },
    ];

    return mockSignals.map((s, i) => ({
      externalId: `mock-personas-${accountId}-${i}`,
      title: s.title,
      content: s.content,
      signalDate: randomDateWithinLast30Days(),
    }));
  }
}

function randomDateWithinLast30Days(): Date {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  return new Date(thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo));
}

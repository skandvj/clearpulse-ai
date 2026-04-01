import { KPICategory, KPISource, Prisma, SignalSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { KPI_EXTRACTION_SYSTEM } from "./prompts";
import { z } from "zod";
import { generateStructuredText } from "@/lib/ai/text-provider";
import { parseOrRepairStructuredJsonResponse } from "@/lib/ai/json-response";

const kpiCategoryValues = [
  "DEFLECTION",
  "EFFICIENCY",
  "ADOPTION",
  "REVENUE",
  "SATISFACTION",
  "RETENTION",
  "CUSTOM",
] as const;

const extractedEvidenceSchema = z.object({
  signalId: z.string().min(1),
  excerpt: z.string().min(1),
  relevance: z.number().min(0).max(1),
});

const extractedKpiSchema = z.object({
  metricName: z.string().min(1).max(500),
  targetValue: z.string().nullable().optional(),
  currentValue: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  category: z.enum(kpiCategoryValues),
  approximateTimestamp: z.number().min(0).nullable().optional(),
  evidence: z.array(extractedEvidenceSchema).min(1),
});

const extractionResponseSchema = z.object({
  kpis: z.array(extractedKpiSchema),
});

export type ExtractionSummary = {
  kpisCreated: number;
  kpisUpdated: number;
  evidenceRows: number;
  signalsMarkedProcessed: number;
  meetingsMarkedExtracted: number;
  chunksProcessed: number;
};

function normalizeMetricName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s/-]/g, "")
    .trim();
}

const MAX_CHARS_PER_CHUNK = 26_000;
const MAX_CONTENT_PER_SIGNAL = 2_800;

type SignalPayload = {
  id: string;
  source: string;
  signalDate: string;
  author: string | null;
  title: string | null;
  content: string;
};

type SignalContext = {
  id: string;
  source: SignalSource;
  externalId: string | null;
  url: string | null;
  signalDate: Date;
};

type MeetingContext = {
  id: string;
  fathomId: string | null;
  recordingUrl: string | null;
  meetingDate: Date;
  duration: number | null;
};

function buildSignalPayloads(
  rows: {
    id: string;
    source: string;
    signalDate: Date;
    author: string | null;
    title: string | null;
    content: string;
  }[]
): SignalPayload[] {
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    signalDate: r.signalDate.toISOString(),
    author: r.author,
    title: r.title,
    content:
      r.content.length > MAX_CONTENT_PER_SIGNAL
        ? `${r.content.slice(0, MAX_CONTENT_PER_SIGNAL)}…`
        : r.content,
  }));
}

function chunkPayloads(payloads: SignalPayload[]): SignalPayload[][] {
  const chunks: SignalPayload[][] = [];
  let current: SignalPayload[] = [];
  let size = 0;

  const overhead = 400;

  for (const p of payloads) {
    const serialized = JSON.stringify(p);
    const add = serialized.length + 2;
    if (size + add + overhead > MAX_CHARS_PER_CHUNK && current.length > 0) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(p);
    size += add;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function parseFathomSignalId(externalId: string | null): string | null {
  if (!externalId?.startsWith("fathom-")) {
    return null;
  }

  const value = externalId.slice("fathom-".length).trim();
  return value || null;
}

function resolveMeetingForSignal(
  signal: SignalContext,
  meetingsByFathomId: Map<string, MeetingContext>,
  meetingsByRecordingUrl: Map<string, MeetingContext>,
  meetings: MeetingContext[]
): MeetingContext | null {
  if (signal.source !== SignalSource.FATHOM) {
    return null;
  }

  const fathomId = parseFathomSignalId(signal.externalId);
  if (fathomId) {
    return meetingsByFathomId.get(fathomId) ?? null;
  }

  if (signal.url) {
    const byUrl = meetingsByRecordingUrl.get(signal.url);
    if (byUrl) {
      return byUrl;
    }
  }

  return (
    meetings.find(
      (meeting) =>
        Math.abs(meeting.meetingDate.getTime() - signal.signalDate.getTime()) <=
        6 * 60 * 60 * 1000
    ) ?? null
  );
}

function normalizeVideoTimestamp(
  value: number | null | undefined,
  durationMinutes: number | null
): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.max(0, Math.round(value));
  if (durationMinutes == null || durationMinutes <= 0) {
    return rounded;
  }

  return Math.min(rounded, durationMinutes * 60);
}

function buildVideoClipUrl(
  recordingUrl: string | null,
  timestamp: number | null
): string | null {
  if (!recordingUrl) {
    return null;
  }

  return timestamp == null ? recordingUrl : `${recordingUrl}#t=${timestamp}`;
}

async function callExtraction(
  signals: SignalPayload[],
  highPriorityAuthors: string[]
): Promise<z.infer<typeof extractedKpiSchema>[]> {
  const userIntro =
    highPriorityAuthors.length > 0
      ? `HIGH_PRIORITY_AUTHORS (weight their statements heavily): ${highPriorityAuthors.join(", ")}\n\n`
      : "";

  const userBody = `${userIntro}Signals (JSON array):\n${JSON.stringify(signals)}`;

  const response = await generateStructuredText({
    system: KPI_EXTRACTION_SYSTEM,
    prompt: userBody,
    maxOutputTokens: 8192,
  });

  let parsed: unknown;
  try {
    parsed = await parseOrRepairStructuredJsonResponse({
      text: response.text,
      taskLabel: "KPI extraction",
      maxOutputTokens: 8192,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message.replace(
            "Failed to parse AI JSON output",
            "Failed to parse AI extraction JSON output"
          )
        : "Failed to parse AI extraction JSON output"
    );
  }

  if (Array.isArray(parsed)) {
    parsed = { kpis: parsed };
  }

  const validated = extractionResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Invalid extraction schema: ${validated.error.issues[0]?.message ?? "unknown"}`
    );
  }

  const validIds = new Set(signals.map((s) => s.id));
  const filtered = validated.data.kpis
    .map((kpi) => ({
      ...kpi,
      evidence: kpi.evidence.filter((e) => validIds.has(e.signalId)),
    }))
    .filter((kpi) => kpi.evidence.length > 0);

  return filtered;
}

function mergeExtracted(
  batches: z.infer<typeof extractedKpiSchema>[][]
): Map<string, z.infer<typeof extractedKpiSchema>> {
  const map = new Map<string, z.infer<typeof extractedKpiSchema>>();

  for (const batch of batches) {
    for (const kpi of batch) {
      const key = normalizeMetricName(kpi.metricName);
      if (!key) continue;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          ...kpi,
          metricName: kpi.metricName.trim(),
          approximateTimestamp: kpi.approximateTimestamp ?? null,
        });
        continue;
      }

      const evidenceBySignal = new Map<string, (typeof kpi.evidence)[0]>();
      for (const e of [...existing.evidence, ...kpi.evidence]) {
        const prev = evidenceBySignal.get(e.signalId);
        if (!prev || e.relevance > prev.relevance) {
          evidenceBySignal.set(e.signalId, e);
        }
      }

      map.set(key, {
        metricName: existing.metricName.length >= kpi.metricName.length ? existing.metricName : kpi.metricName.trim(),
        targetValue: kpi.targetValue ?? existing.targetValue ?? null,
        currentValue: kpi.currentValue ?? existing.currentValue ?? null,
        unit: kpi.unit ?? existing.unit ?? null,
        category: kpi.category,
        approximateTimestamp:
          existing.approximateTimestamp ?? kpi.approximateTimestamp ?? null,
        evidence: Array.from(evidenceBySignal.values()).sort(
          (a, b) => b.relevance - a.relevance
        ),
      });
    }
  }

  return map;
}

export async function runKpiExtraction(
  accountId: string,
  changedByUserId: string
): Promise<ExtractionSummary> {
  const [signals, contacts, meetings] = await Promise.all([
    prisma.rawSignal.findMany({
      where: { accountId },
      orderBy: { signalDate: "desc" },
      take: 400,
      select: {
        id: true,
        source: true,
        signalDate: true,
        externalId: true,
        author: true,
        title: true,
        content: true,
        url: true,
      },
    }),
    prisma.contact.findMany({
      where: { accountId },
      select: { name: true },
    }),
    prisma.meeting.findMany({
      where: { accountId },
      select: {
        id: true,
        fathomId: true,
        recordingUrl: true,
        meetingDate: true,
        duration: true,
      },
    }),
  ]);

  if (signals.length === 0) {
    return {
      kpisCreated: 0,
      kpisUpdated: 0,
      evidenceRows: 0,
      signalsMarkedProcessed: 0,
      meetingsMarkedExtracted: 0,
      chunksProcessed: 0,
    };
  }

  const highPriorityAuthors = contacts
    .map((c) => c.name.trim())
    .filter(Boolean);

  const payloads = buildSignalPayloads(signals);
  const chunks = chunkPayloads(payloads);
  const signalContextById = new Map<string, SignalContext>(
    signals.map((signal) => [
      signal.id,
      {
        id: signal.id,
        source: signal.source,
        externalId: signal.externalId ?? null,
        url: signal.url ?? null,
        signalDate: signal.signalDate,
      },
    ])
  );
  const meetingsByFathomId = new Map<string, MeetingContext>(
    meetings
      .filter((meeting) => !!meeting.fathomId)
      .map((meeting) => [meeting.fathomId as string, meeting])
  );
  const meetingsByRecordingUrl = new Map<string, MeetingContext>(
    meetings
      .filter((meeting) => !!meeting.recordingUrl)
      .map((meeting) => [meeting.recordingUrl as string, meeting])
  );

  const batchResults: z.infer<typeof extractedKpiSchema>[][] = [];
  for (const chunk of chunks) {
    const kpis = await callExtraction(chunk, highPriorityAuthors);
    batchResults.push(kpis);
  }

  const merged = mergeExtracted(batchResults);
  const existingKpis = await prisma.clientKPI.findMany({
    where: { accountId },
    select: {
      id: true,
      metricName: true,
      source: true,
      currentValue: true,
    },
  });

  const existingByNorm = new Map<string, (typeof existingKpis)[0]>();
  for (const k of existingKpis) {
    existingByNorm.set(normalizeMetricName(k.metricName), k);
  }

  const mergedList = Array.from(merged.values());
  const toProcess = mergedList.filter((kpi) => {
    const match = existingByNorm.get(normalizeMetricName(kpi.metricName));
    return !match || match.source !== KPISource.MANUAL;
  });

  if (toProcess.length === 0) {
    return {
      kpisCreated: 0,
      kpisUpdated: 0,
      evidenceRows: 0,
      signalsMarkedProcessed: 0,
      meetingsMarkedExtracted: 0,
      chunksProcessed: chunks.length,
    };
  }

  let kpisCreated = 0;
  let kpisUpdated = 0;
  let evidenceRows = 0;
  const signalIdsToMark = new Set<string>();
  const meetingIdsToMark = new Set<string>();

  await prisma.$transaction(async (tx) => {
    for (const kpi of toProcess) {
      const norm = normalizeMetricName(kpi.metricName);
      const match = existingByNorm.get(norm);

      if (match && match.source === KPISource.MANUAL) {
        continue;
      }

      let kpiId: string;
      const primaryMeeting =
        [...kpi.evidence]
          .sort((a, b) => b.relevance - a.relevance)
          .map((evidence) => signalContextById.get(evidence.signalId))
          .filter((signal): signal is SignalContext => !!signal)
          .map((signal) =>
            resolveMeetingForSignal(
              signal,
              meetingsByFathomId,
              meetingsByRecordingUrl,
              meetings
            )
          )
          .find((meeting): meeting is MeetingContext => !!meeting) ?? null;
      const matchedMeetingIds = new Set(
        kpi.evidence
          .map((evidence) => signalContextById.get(evidence.signalId))
          .filter((signal): signal is SignalContext => !!signal)
          .map((signal) =>
            resolveMeetingForSignal(
              signal,
              meetingsByFathomId,
              meetingsByRecordingUrl,
              meetings
            )
          )
          .filter((meeting): meeting is MeetingContext => !!meeting)
          .map((meeting) => meeting.id)
      );
      const videoTimestamp = primaryMeeting
        ? normalizeVideoTimestamp(
            kpi.approximateTimestamp,
            primaryMeeting.duration
          )
        : null;
      const videoClipUrl = primaryMeeting
        ? buildVideoClipUrl(primaryMeeting.recordingUrl, videoTimestamp)
        : null;

      if (match) {
        kpisUpdated++;
        kpiId = match.id;
        await tx.clientKPI.update({
          where: { id: kpiId },
          data: {
            metricName: kpi.metricName,
            targetValue: kpi.targetValue ?? undefined,
            currentValue: kpi.currentValue ?? undefined,
            unit: kpi.unit ?? undefined,
            category: kpi.category as KPICategory,
            source: KPISource.AI_EXTRACTED,
            status: "ON_TRACK",
            ...(videoTimestamp != null ? { videoTimestamp } : {}),
            ...(videoClipUrl ? { videoClipUrl } : {}),
          },
        });

        if (
          kpi.currentValue != null &&
          kpi.currentValue !== match.currentValue
        ) {
          await tx.kPIHistory.create({
            data: {
              kpiId,
              value: kpi.currentValue,
              changedBy: changedByUserId,
              note: "Updated from AI extraction",
            },
          });
        }
      } else {
        kpisCreated++;
        const created = await tx.clientKPI.create({
          data: {
            accountId,
            metricName: kpi.metricName,
            targetValue: kpi.targetValue ?? undefined,
            currentValue: kpi.currentValue ?? undefined,
            unit: kpi.unit ?? undefined,
            category: kpi.category as KPICategory,
            source: KPISource.AI_EXTRACTED,
            status: "ON_TRACK",
            ...(videoTimestamp != null ? { videoTimestamp } : {}),
            ...(videoClipUrl ? { videoClipUrl } : {}),
          },
        });
        kpiId = created.id;
        existingByNorm.set(norm, {
          id: kpiId,
          metricName: kpi.metricName,
          source: KPISource.AI_EXTRACTED,
          currentValue: kpi.currentValue ?? null,
        });

        if (kpi.currentValue) {
          await tx.kPIHistory.create({
            data: {
              kpiId,
              value: kpi.currentValue,
              changedBy: changedByUserId,
              note: "Initial value (AI extraction)",
            },
          });
        }
      }

      matchedMeetingIds.forEach((meetingId) => {
        meetingIdsToMark.add(meetingId);
      });

      for (const ev of kpi.evidence) {
        await tx.kPIEvidence.upsert({
          where: {
            kpiId_signalId: { kpiId, signalId: ev.signalId },
          },
          create: {
            kpiId,
            signalId: ev.signalId,
            excerpt: ev.excerpt,
            relevance: ev.relevance,
          },
          update: {
            excerpt: ev.excerpt,
            relevance: ev.relevance,
          },
        });
        evidenceRows++;
        signalIdsToMark.add(ev.signalId);
      }
    }

    if (signalIdsToMark.size > 0) {
      await tx.rawSignal.updateMany({
        where: { id: { in: Array.from(signalIdsToMark) } },
        data: { processed: true },
      });
    }

    if (meetingIdsToMark.size > 0) {
      await tx.meeting.updateMany({
        where: { id: { in: Array.from(meetingIdsToMark) } },
        data: { extractedKPIs: true },
      });
    }

    if (kpisCreated > 0 || kpisUpdated > 0 || evidenceRows > 0) {
      await tx.auditLog.create({
        data: {
          userId: changedByUserId,
          action: "KPI_EXTRACTION",
          entityType: "ClientAccount",
          entityId: accountId,
          metadata: {
            kpisCreated,
            kpisUpdated,
            evidenceRows,
            signalsMarkedProcessed: signalIdsToMark.size,
            meetingsMarkedExtracted: meetingIdsToMark.size,
          } as Prisma.InputJsonValue,
        },
      });
    }
  });

  return {
    kpisCreated,
    kpisUpdated,
    evidenceRows,
    signalsMarkedProcessed: signalIdsToMark.size,
    meetingsMarkedExtracted: meetingIdsToMark.size,
    chunksProcessed: chunks.length,
  };
}

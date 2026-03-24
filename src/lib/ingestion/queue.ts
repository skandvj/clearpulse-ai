import { Queue } from "bullmq";
import { SignalSource } from "@prisma/client";
import { getRedisConnectionOptions } from "./redis";
import { prisma } from "@/lib/db";
import type { IngestionResult } from "./types";
import { logWarn } from "@/lib/logging";

const QUEUE_NAME = "signal-ingestion";

export interface IngestSourceJobData {
  source: SignalSource;
  accountId: string;
  since?: string;
  triggeredBy: string;
  syncJobId?: string;
}

export interface QueuedSyncReference {
  source: SignalSource;
  accountId: string;
  syncJobId: string;
  queueJobId: string;
}

export interface InlineSyncReference extends IngestionResult {
  source: SignalSource;
  accountId: string;
}

export type SyncDispatchResult =
  | {
      mode: "queued";
      jobs: QueuedSyncReference[];
    }
  | {
      mode: "inline";
      results: InlineSyncReference[];
    };

let queue: Queue | null = null;

function getQueue(): Queue | null {
  if (queue) return queue;

  const opts = getRedisConnectionOptions();
  if (!opts) return null;

  const connection = {
    url: opts.url,
    ...(opts.tls ? { tls: { rejectUnauthorized: false } } : {}),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  queue = new Queue(QUEUE_NAME, { connection: connection as never });
  return queue;
}

export async function enqueueIngestion(
  source: SignalSource,
  accountId: string,
  triggeredBy: string,
  since?: Date
): Promise<SyncDispatchResult> {
  const q = getQueue();

  if (q) {
    const syncJob = await prisma.syncJob.create({
      data: {
        source,
        accountId,
        triggeredBy,
        status: "PENDING",
      },
      select: { id: true },
    });
    const data: IngestSourceJobData = {
      source,
      accountId,
      triggeredBy,
      syncJobId: syncJob.id,
      since: since?.toISOString(),
    };
    const job = await q.add("ingest-source", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
    return {
      mode: "queued",
      jobs: [
        {
          source,
          accountId,
          syncJobId: syncJob.id,
          queueJobId: String(job.id),
        },
      ],
    };
  }

  logWarn("ingestion.queue.inline_fallback", {
    source,
    accountId,
    triggeredBy,
  });
  const { processIngestionJob } = await import("./service");
  const result = await processIngestionJob(source, accountId, triggeredBy, since);
  return {
    mode: "inline",
    results: [{ source, accountId, ...result }],
  };
}

const ALL_SOURCES: SignalSource[] = [
  "SLACK",
  "FATHOM",
  "AM_MEETING",
  "VITALLY",
  "SALESFORCE",
  "PERSONAS",
  "SHAREPOINT",
  "JIRA",
  "GOOGLE_DRIVE",
];

export async function enqueueBulkSync(
  accountId: string,
  triggeredBy: string,
  since?: Date
): Promise<SyncDispatchResult> {
  const q = getQueue();

  if (q) {
    const syncJobs = await prisma.$transaction(
      ALL_SOURCES.map((source) =>
        prisma.syncJob.create({
          data: {
            source,
            accountId,
            triggeredBy,
            status: "PENDING",
          },
          select: { id: true, source: true, accountId: true },
        })
      )
    );

    const jobs = syncJobs.map((syncJob) => ({
      name: "ingest-source",
      data: {
        source: syncJob.source,
        accountId: syncJob.accountId!,
        triggeredBy,
        syncJobId: syncJob.id,
        since: since?.toISOString(),
      } as Record<string, unknown>,
      opts: {
        attempts: 3,
        backoff: { type: "exponential" as const, delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }));
    const queued = await q.addBulk(jobs);
    return {
      mode: "queued",
      jobs: queued.map((job, index) => ({
        source: syncJobs[index].source,
        accountId: syncJobs[index].accountId!,
        syncJobId: syncJobs[index].id,
        queueJobId: String(job.id),
      })),
    };
  }

  logWarn("ingestion.queue.bulk_inline_fallback", {
    accountId,
    triggeredBy,
    sourceCount: ALL_SOURCES.length,
  });
  const { processIngestionJob } = await import("./service");
  const results: InlineSyncReference[] = [];
  for (const source of ALL_SOURCES) {
    const result = await processIngestionJob(source, accountId, triggeredBy, since);
    results.push({ source, accountId, ...result });
  }
  return {
    mode: "inline",
    results,
  };
}

export { QUEUE_NAME, getQueue };

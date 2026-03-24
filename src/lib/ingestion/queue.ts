import { Queue } from "bullmq";
import { SignalSource } from "@prisma/client";
import { getRedisConnectionOptions } from "./redis";

const QUEUE_NAME = "signal-ingestion";

export interface IngestSourceJobData {
  source: SignalSource;
  accountId: string;
  since?: string;
  triggeredBy: string;
}

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
): Promise<void> {
  const q = getQueue();

  if (q) {
    const data: IngestSourceJobData = {
      source,
      accountId,
      triggeredBy,
      since: since?.toISOString(),
    };
    await q.add("ingest-source", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
    return;
  }

  console.warn(
    "[ingestion/queue] Queue unavailable — running ingestion synchronously"
  );
  const { processIngestionJob } = await import("./service");
  await processIngestionJob(source, accountId, triggeredBy, since);
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
): Promise<void> {
  const q = getQueue();

  if (q) {
    const jobs = ALL_SOURCES.map((source) => ({
      name: "ingest-source",
      data: {
        source,
        accountId,
        triggeredBy,
        since: since?.toISOString(),
      } as Record<string, unknown>,
      opts: {
        attempts: 3,
        backoff: { type: "exponential" as const, delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }));
    await q.addBulk(jobs);
    return;
  }

  console.warn(
    "[ingestion/queue] Queue unavailable — running bulk sync synchronously"
  );
  const { processIngestionJob } = await import("./service");
  for (const source of ALL_SOURCES) {
    await processIngestionJob(source, accountId, triggeredBy, since);
  }
}

export { QUEUE_NAME, getQueue };

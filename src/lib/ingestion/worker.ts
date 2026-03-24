import { Worker, Job } from "bullmq";
import { SignalSource } from "@prisma/client";
import { getRedisConnectionOptions, isQueueAvailable } from "./redis";
import { processIngestionJob } from "./service";
import { QUEUE_NAME, type IngestSourceJobData } from "./queue";

let worker: Worker | null = null;

export function startWorker(): void {
  if (!isQueueAvailable()) {
    console.warn(
      "[ingestion/worker] Redis unavailable — worker not started"
    );
    return;
  }

  if (worker) {
    console.warn("[ingestion/worker] Worker already running");
    return;
  }

  const opts = getRedisConnectionOptions()!;
  const connection = {
    url: opts.url,
    ...(opts.tls ? { tls: { rejectUnauthorized: false } } : {}),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const { source, accountId, triggeredBy, since } =
        job.data as IngestSourceJobData;

      console.log(
        `[ingestion/worker] Processing job ${job.id}: ${source} for account ${accountId}`
      );

      const result = await processIngestionJob(
        source as SignalSource,
        accountId,
        triggeredBy,
        since ? new Date(since) : undefined
      );

      console.log(
        `[ingestion/worker] Job ${job.id} completed: ${result.newSignals} new signals, ${result.duplicatesSkipped} duplicates skipped`
      );

      if (result.errors.length > 0) {
        console.warn(
          `[ingestion/worker] Job ${job.id} had ${result.errors.length} errors:`,
          result.errors
        );
      }

      return result;
    },
    {
      connection: connection as never,
      concurrency: 3,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(
      `[ingestion/worker] Job ${job?.id} failed:`,
      err.message
    );
  });

  worker.on("error", (err) => {
    console.error("[ingestion/worker] Worker error:", err);
  });

  console.log("[ingestion/worker] Worker started");
}

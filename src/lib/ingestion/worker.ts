import { Worker, Job } from "bullmq";
import { SignalSource } from "@prisma/client";
import { getRedisConnectionOptions, isQueueAvailable } from "./redis";
import { processIngestionJob } from "./service";
import { QUEUE_NAME, type IngestSourceJobData } from "./queue";
import { logError, logInfo, logWarn } from "@/lib/logging";

let worker: Worker | null = null;

export function startWorker(): void {
  if (!isQueueAvailable()) {
    logWarn("ingestion.worker.unavailable", {});
    return;
  }

  if (worker) {
    logWarn("ingestion.worker.already_running", {});
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
      const { source, accountId, triggeredBy, since, syncJobId } =
        job.data as IngestSourceJobData;

      logInfo("ingestion.worker.job_started", {
        queueJobId: String(job.id),
        source,
        accountId,
      });

      const result = await processIngestionJob(
        source as SignalSource,
        accountId,
        triggeredBy,
        since ? new Date(since) : undefined,
        typeof syncJobId === "string" ? syncJobId : undefined
      );

      logInfo("ingestion.worker.job_completed", {
        queueJobId: String(job.id),
        source,
        accountId,
        newSignals: result.newSignals,
        duplicatesSkipped: result.duplicatesSkipped,
        errorCount: result.errors.length,
      });

      if (result.errors.length > 0) {
        logWarn("ingestion.worker.job_partial_errors", {
          queueJobId: String(job.id),
          source,
          accountId,
          errors: result.errors,
        });
      }

      return result;
    },
    {
      connection: connection as never,
      concurrency: 3,
    }
  );

  worker.on("failed", (job, err) => {
    logError("ingestion.worker.job_failed", err, {
      queueJobId: job?.id ? String(job.id) : null,
    });
  });

  worker.on("error", (err) => {
    logError("ingestion.worker.error", err);
  });

  logInfo("ingestion.worker.started", {});
}

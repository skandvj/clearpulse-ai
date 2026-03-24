import { SignalSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateEmbedding } from "./embeddings";
import { isDuplicate } from "./dedup";
import type { IngestionResult, SourceAdapter } from "./types";
import { getAdapter as getRegisteredAdapter } from "@/lib/sources";
import { logError, logInfo } from "@/lib/logging";

function getAdapter(source: SignalSource): SourceAdapter {
  return getRegisteredAdapter(source);
}

export async function processIngestionJob(
  source: SignalSource,
  accountId: string,
  triggeredBy: string,
  since?: Date,
  syncJobId?: string
): Promise<IngestionResult> {
  const result: IngestionResult = {
    totalFetched: 0,
    newSignals: 0,
    duplicatesSkipped: 0,
    errors: [],
  };

  const syncJob = syncJobId
    ? await prisma.syncJob.findUnique({
        where: { id: syncJobId },
        select: { id: true },
      })
    : await prisma.syncJob.create({
        data: {
          source,
          accountId,
          triggeredBy,
          status: "PENDING",
        },
        select: { id: true },
      });

  if (!syncJob) {
    throw new Error(`SyncJob ${syncJobId} was not found`);
  }

  try {
    logInfo("ingestion.service.started", {
      source,
      accountId,
      triggeredBy,
      syncJobId: syncJob.id,
      since: since?.toISOString(),
    });

    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        completedAt: null,
        error: null,
      },
    });

    const adapter = getAdapter(source);
    const signals = await adapter.fetchSignals(accountId, since);
    result.totalFetched = signals.length;

    for (const signal of signals) {
      try {
        const existing = await prisma.rawSignal.findFirst({
          where: {
            accountId,
            source,
            externalId: signal.externalId,
          },
          select: { id: true },
        });

        if (existing) {
          result.duplicatesSkipped++;
          continue;
        }

        const embedding = await generateEmbedding(signal.content);

        const isAllZeros = embedding.every((v) => v === 0);
        if (!isAllZeros) {
          const duplicate = await isDuplicate(accountId, embedding);
          if (duplicate) {
            result.duplicatesSkipped++;
            continue;
          }
        }

        const created = await prisma.rawSignal.create({
          data: {
            accountId,
            source,
            externalId: signal.externalId,
            title: signal.title,
            content: signal.content,
            author: signal.author,
            url: signal.url,
            signalDate: signal.signalDate,
          },
        });

        if (!isAllZeros) {
          await prisma.$executeRawUnsafe(
            'UPDATE "RawSignal" SET embedding = $1::vector WHERE id = $2',
            `[${embedding.join(",")}]`,
            created.id
          );
        }

        result.newSignals++;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown error processing signal";
        result.errors.push(`[${signal.externalId}] ${msg}`);
      }
    }

    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        signalsFound: result.totalFetched,
        error: null,
      },
    });

    await prisma.clientAccount.update({
      where: { id: accountId },
      data: { lastSyncedAt: new Date() },
    });

    logInfo("ingestion.service.completed", {
      source,
      accountId,
      triggeredBy,
      syncJobId: syncJob.id,
      totalFetched: result.totalFetched,
      newSignals: result.newSignals,
      duplicatesSkipped: result.duplicatesSkipped,
      errorCount: result.errors.length,
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown ingestion error";
    result.errors.push(errorMsg);

    logError("ingestion.service.failed", err, {
      source,
      accountId,
      triggeredBy,
      syncJobId: syncJob.id,
    });

    await prisma.syncJob
      .update({
        where: { id: syncJob.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          error: errorMsg,
        },
      })
      .catch((updateErr) =>
        logError("ingestion.service.sync_job_update_failed", updateErr, {
          source,
          accountId,
          syncJobId: syncJob.id,
        })
      );
  }

  return result;
}

import { SignalSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateEmbedding } from "./embeddings";
import { isDuplicate } from "./dedup";
import type { IngestionResult, SourceAdapter } from "./types";

async function getAdapter(source: SignalSource): Promise<SourceAdapter> {
  const mod = await import(`@/lib/sources/${source.toLowerCase()}`);
  return mod.default as SourceAdapter;
}

export async function processIngestionJob(
  source: SignalSource,
  accountId: string,
  triggeredBy: string,
  since?: Date
): Promise<IngestionResult> {
  const result: IngestionResult = {
    totalFetched: 0,
    newSignals: 0,
    duplicatesSkipped: 0,
    errors: [],
  };

  const syncJob = await prisma.syncJob.create({
    data: {
      source,
      accountId,
      triggeredBy,
      status: "PENDING",
    },
  });

  try {
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    const adapter = await getAdapter(source);
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
      },
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown ingestion error";
    result.errors.push(errorMsg);

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
        console.error("[ingestion/service] Failed to update SyncJob:", updateErr)
      );
  }

  return result;
}

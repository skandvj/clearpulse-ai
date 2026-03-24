import { prisma } from "@/lib/db";
import { logError } from "@/lib/logging";

const DEFAULT_THRESHOLD = 0.95;

export async function isDuplicate(
  accountId: string,
  embedding: number[],
  threshold: number = DEFAULT_THRESHOLD
): Promise<boolean> {
  try {
    const vectorStr = `[${embedding.join(",")}]`;

    const results = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "RawSignal" WHERE "accountId" = $1 AND embedding IS NOT NULL AND 1 - (embedding <=> $2::vector) > $3 LIMIT 1`,
      accountId,
      vectorStr,
      threshold
    );

    return results.length > 0;
  } catch (err) {
    logError("ingestion.dedup.failed", err, {
      accountId,
      threshold,
    });
    return false;
  }
}

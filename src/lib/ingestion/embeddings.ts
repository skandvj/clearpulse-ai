import OpenAI from "openai";
import { getAIRuntimeValue } from "@/lib/ai/settings";
import { logError, logWarn } from "@/lib/logging";

const MAX_TEXT_LENGTH = 8000;
const EMBEDDING_DIM = 1536;
const MAX_RETRIES = 3;

let client: OpenAI | null = null;
let clientKey: string | null = null;
let missingKeyLogged = false;

async function getClient(): Promise<OpenAI | null> {
  const apiKey = await getAIRuntimeValue("OPENAI_API_KEY");
  if (!apiKey) {
    if (!missingKeyLogged) {
      missingKeyLogged = true;
      logWarn("ingestion.embeddings.disabled", {
        reason: "OPENAI_API_KEY missing",
      });
    }

    client = null;
    clientKey = null;
    return null;
  }

  missingKeyLogged = false;

  if (client && clientKey === apiKey) {
    return client;
  }

  client = new OpenAI({ apiKey });
  clientKey = apiKey;
  return client;
}

function zeroVector(): number[] {
  return new Array(EMBEDDING_DIM).fill(0);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = await getClient();
  if (!openai) return zeroVector();

  const truncated = text.slice(0, MAX_TEXT_LENGTH);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: truncated,
      });
      return response.data[0].embedding;
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof OpenAI.APIError && err.status === 429;

      if (isRateLimit && attempt < MAX_RETRIES - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        logWarn("ingestion.embeddings.rate_limited", {
          delayMs: delay,
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      logError("ingestion.embeddings.failed", err, {
        attempt: attempt + 1,
      });
      return zeroVector();
    }
  }

  return zeroVector();
}

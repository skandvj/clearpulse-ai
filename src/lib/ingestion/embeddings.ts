import OpenAI from "openai";

const MAX_TEXT_LENGTH = 8000;
const EMBEDDING_DIM = 1536;
const MAX_RETRIES = 3;

let client: OpenAI | null = null;
let clientChecked = false;

function getClient(): OpenAI | null {
  if (clientChecked) return client;
  clientChecked = true;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn(
      "[ingestion/embeddings] OPENAI_API_KEY not configured — embeddings disabled"
    );
    return null;
  }

  client = new OpenAI({ apiKey });
  return client;
}

function zeroVector(): number[] {
  return new Array(EMBEDDING_DIM).fill(0);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getClient();
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
        console.warn(
          `[ingestion/embeddings] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      console.error("[ingestion/embeddings] Failed to generate embedding:", err);
      return zeroVector();
    }
  }

  return zeroVector();
}

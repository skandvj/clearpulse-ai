import Anthropic from "@anthropic-ai/sdk";
import {
  getAIRuntimeValue,
  getAITextProvider,
  type AITextProvider,
} from "@/lib/ai/settings";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GenerateStructuredTextInput {
  system: string;
  prompt: string;
  maxOutputTokens: number;
  temperature?: number;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
}

async function getAnthropicApiKey(): Promise<string> {
  const key = await getAIRuntimeValue("ANTHROPIC_API_KEY");
  if (!key) {
    throw new Error("AI text provider is not configured");
  }

  return key;
}

async function getGeminiApiKey(): Promise<string> {
  const key = await getAIRuntimeValue("GEMINI_API_KEY");
  if (!key) {
    throw new Error("AI text provider is not configured");
  }

  return key;
}

async function generateWithAnthropic(
  input: GenerateStructuredTextInput
): Promise<string> {
  const apiKey = await getAnthropicApiKey();
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: input.maxOutputTokens,
    temperature: input.temperature ?? 0,
    system: input.system,
    messages: [
      {
        role: "user",
        content: input.prompt,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic returned no text content");
  }

  return textBlock.text;
}

async function generateWithGemini(
  input: GenerateStructuredTextInput
): Promise<string> {
  const apiKey = await getGeminiApiKey();
  const response = await fetch(
    `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.system }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: input.prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: input.maxOutputTokens,
          temperature: input.temperature ?? 0,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Gemini request failed (${response.status})${
        errorText ? `: ${errorText}` : ""
      }`
    );
  }

  const body = (await response.json()) as GeminiGenerateContentResponse;
  const text = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    if (body.promptFeedback?.blockReason) {
      throw new Error(
        `Gemini returned no text content (${body.promptFeedback.blockReason})`
      );
    }

    throw new Error("Gemini returned no text content");
  }

  return text;
}

export async function generateStructuredText(
  input: GenerateStructuredTextInput
): Promise<{ provider: AITextProvider; text: string }> {
  const provider = await getAITextProvider();

  if (provider === "gemini") {
    return {
      provider,
      text: await generateWithGemini(input),
    };
  }

  return {
    provider,
    text: await generateWithAnthropic(input),
  };
}

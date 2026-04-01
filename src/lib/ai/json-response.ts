import { generateStructuredText } from "@/lib/ai/text-provider";

function compactPreview(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

function uniqueCandidates(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))
  );
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseStructuredJsonResponse(text: string): unknown {
  const trimmed = text.trim().replace(/^\uFEFF/, "");
  const withoutFences = stripCodeFences(trimmed);

  const candidates = uniqueCandidates([
    trimmed,
    withoutFences,
    withoutFences.replace(/^json\s*/i, ""),
  ]);

  const firstObjectIndex = withoutFences.indexOf("{");
  const lastObjectIndex = withoutFences.lastIndexOf("}");
  if (firstObjectIndex >= 0 && lastObjectIndex > firstObjectIndex) {
    candidates.push(
      withoutFences.slice(firstObjectIndex, lastObjectIndex + 1).trim()
    );
  }

  const firstArrayIndex = withoutFences.indexOf("[");
  const lastArrayIndex = withoutFences.lastIndexOf("]");
  if (firstArrayIndex >= 0 && lastArrayIndex > firstArrayIndex) {
    candidates.push(
      withoutFences.slice(firstArrayIndex, lastArrayIndex + 1).trim()
    );
  }

  let lastError: unknown = null;
  for (const candidate of uniqueCandidates(candidates)) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  const detail =
    lastError instanceof Error ? ` (${lastError.message})` : "";
  throw new Error(
    `Failed to parse AI JSON output${detail}. Preview: ${compactPreview(text)}`
  );
}

export async function parseOrRepairStructuredJsonResponse(input: {
  text: string;
  taskLabel: string;
  maxOutputTokens?: number;
}): Promise<unknown> {
  try {
    return parseStructuredJsonResponse(input.text);
  } catch (initialError) {
    const repaired = await generateStructuredText({
      system:
        "You repair malformed JSON. Return ONLY valid JSON. Preserve the original structure, keys, and values as closely as possible. Do not add markdown fences or commentary.",
      prompt: [
        `Task: Repair malformed JSON for ${input.taskLabel}.`,
        "Requirements:",
        "- Return one valid JSON object or array only.",
        "- Keep the same meaning and values whenever possible.",
        "- Only make minimal fixes needed for valid syntax.",
        "",
        "Malformed JSON:",
        input.text,
      ].join("\n"),
      maxOutputTokens: input.maxOutputTokens ?? 8192,
      temperature: 0,
    });

    try {
      return parseStructuredJsonResponse(repaired.text);
    } catch (repairError) {
      const initialMessage =
        initialError instanceof Error ? initialError.message : "unknown";
      const repairMessage =
        repairError instanceof Error ? repairError.message : "unknown";
      throw new Error(
        `${initialMessage} Repair attempt also failed: ${repairMessage}`
      );
    }
  }
}

import { prisma } from "@/lib/db";
import {
  decryptIntegrationValue,
  encryptIntegrationValue,
} from "@/lib/integrations/crypto";

export type AIProviderKey = "ANTHROPIC_API_KEY" | "OPENAI_API_KEY";
export type AISettingValueSource = "database" | "environment" | "missing";

export interface AIFieldDefinition {
  key: AIProviderKey;
  label: string;
  provider: "Anthropic" | "OpenAI";
  secret: boolean;
  browserEditable: boolean;
  helperText: string;
  placeholder?: string;
}

export interface AIFieldState extends AIFieldDefinition {
  configured: boolean;
  source: AISettingValueSource;
  value: string | null;
  valuePreview: string | null;
}

const AI_FIELD_DEFINITIONS: AIFieldDefinition[] = [
  {
    key: "ANTHROPIC_API_KEY",
    label: "Anthropic API Key",
    provider: "Anthropic",
    secret: true,
    browserEditable: true,
    helperText:
      "Used for KPI extraction and KPI health scoring inside ClearPulse.",
    placeholder: "Enter Claude API key",
  },
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI API Key",
    provider: "OpenAI",
    secret: true,
    browserEditable: true,
    helperText:
      "Used for embeddings and semantic deduplication during ingestion.",
    placeholder: "Enter OpenAI API key",
  },
];

function getEnvFallback(key: AIProviderKey): string | null {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    return null;
  }

  return value;
}

function maskValue(value: string): string {
  if (value.length <= 4) {
    return "••••";
  }

  if (value.length <= 10) {
    return `${"•".repeat(Math.max(value.length - 2, 2))}${value.slice(-2)}`;
  }

  return `${value.slice(0, 2)}${"•".repeat(Math.min(value.length - 4, 8))}${value.slice(-2)}`;
}

export async function listAISettings() {
  return prisma.aiSetting.findMany({
    select: {
      key: true,
      encryptedValue: true,
      isSecret: true,
    },
  });
}

export async function getAIRuntimeValue(
  key: AIProviderKey
): Promise<string | undefined> {
  const settings = await listAISettings();
  const stored = settings.find((item) => item.key === key);

  if (stored) {
    return decryptIntegrationValue(stored.encryptedValue);
  }

  return process.env[key];
}

export async function buildAIFieldStates(): Promise<AIFieldState[]> {
  const settings = await listAISettings();
  const storedByKey = new Map(settings.map((item) => [item.key, item]));

  return AI_FIELD_DEFINITIONS.map((field) => {
    const stored = storedByKey.get(field.key);
    if (stored) {
      const value = decryptIntegrationValue(stored.encryptedValue);

      return {
        ...field,
        configured: true,
        source: "database" as const,
        value: null,
        valuePreview: maskValue(value),
      };
    }

    const envValue = getEnvFallback(field.key);
    if (envValue) {
      return {
        ...field,
        configured: true,
        source: "environment" as const,
        value: null,
        valuePreview: maskValue(envValue),
      };
    }

    return {
      ...field,
      configured: false,
      source: "missing" as const,
      value: null,
      valuePreview: null,
    };
  });
}

export function summarizeAIFields(fields: AIFieldState[]) {
  return {
    configuredCount: fields.filter((field) => field.configured).length,
    requiredCount: fields.length,
    missingKeys: fields
      .filter((field) => !field.configured)
      .map((field) => field.key),
  };
}

export async function upsertAISettings(input: {
  userId: string;
  values: Partial<Record<AIProviderKey, string>>;
}) {
  const operations = Object.entries(input.values).flatMap(([key, rawValue]) => {
    if (!rawValue) {
      return [];
    }

    const value = rawValue.trim();
    if (!value) {
      return [];
    }

    return [
      prisma.aiSetting.upsert({
        where: { key },
        create: {
          key,
          encryptedValue: encryptIntegrationValue(value),
          isSecret: true,
          updatedById: input.userId,
        },
        update: {
          encryptedValue: encryptIntegrationValue(value),
          isSecret: true,
          updatedById: input.userId,
        },
      }),
    ];
  });

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }
}

import { prisma } from "@/lib/db";
import {
  decryptIntegrationValue,
  encryptIntegrationValue,
} from "@/lib/integrations/crypto";

export type AIProviderKey =
  | "AI_TEXT_PROVIDER"
  | "ANTHROPIC_API_KEY"
  | "GEMINI_API_KEY"
  | "OPENAI_API_KEY";
export type AITextProvider = "anthropic" | "gemini";
export type AISettingValueSource =
  | "database"
  | "environment"
  | "default"
  | "missing";
export type AIFieldInputType =
  | "text"
  | "password"
  | "url"
  | "email"
  | "select";

export interface AIFieldDefinition {
  key: AIProviderKey;
  label: string;
  provider: "Selection" | "Anthropic" | "Google Gemini" | "OpenAI";
  secret: boolean;
  browserEditable: boolean;
  helperText: string;
  placeholder?: string;
  inputType: AIFieldInputType;
  options?: Array<{
    label: string;
    value: string;
  }>;
  countInSummary?: boolean;
}

export interface AIFieldState extends AIFieldDefinition {
  configured: boolean;
  source: AISettingValueSource;
  value: string | null;
  valuePreview: string | null;
}

const DEFAULT_TEXT_PROVIDER: AITextProvider = "anthropic";

const AI_FIELD_DEFINITIONS: AIFieldDefinition[] = [
  {
    key: "AI_TEXT_PROVIDER",
    label: "Text AI Provider",
    provider: "Selection",
    secret: false,
    browserEditable: true,
    helperText: "Choose which provider powers KPI extraction and health scoring.",
    inputType: "select",
    options: [
      {
        label: "Anthropic",
        value: "anthropic",
      },
      {
        label: "Google Gemini",
        value: "gemini",
      },
    ],
    countInSummary: false,
  },
  {
    key: "ANTHROPIC_API_KEY",
    label: "Anthropic API Key",
    provider: "Anthropic",
    secret: true,
    browserEditable: true,
    helperText:
      "Used for KPI extraction and KPI health scoring inside ClearPulse.",
    placeholder: "Enter Claude API key",
    inputType: "password",
  },
  {
    key: "GEMINI_API_KEY",
    label: "Gemini API Key",
    provider: "Google Gemini",
    secret: true,
    browserEditable: true,
    helperText:
      "Used when Gemini is selected for KPI extraction and health scoring.",
    placeholder: "Enter Gemini API key",
    inputType: "password",
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
    inputType: "password",
  },
];

function getEnvFallback(key: AIProviderKey): string | null {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    return null;
  }

  return value;
}

function getDefinition(key: AIProviderKey): AIFieldDefinition {
  return (
    AI_FIELD_DEFINITIONS.find((field) => field.key === key) ??
    AI_FIELD_DEFINITIONS[0]
  );
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

function normalizeTextProvider(value: string | null | undefined): AITextProvider {
  return value?.trim().toLowerCase() === "gemini"
    ? "gemini"
    : DEFAULT_TEXT_PROVIDER;
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

function getResolvedTextProviderFromValues(values: {
  providerSetting: string | null;
  anthropicKey: string | null;
  geminiKey: string | null;
}): {
  provider: AITextProvider;
  source: AISettingValueSource;
} {
  if (values.providerSetting) {
    return {
      provider: normalizeTextProvider(values.providerSetting),
      source: "database",
    };
  }

  const envProvider = getEnvFallback("AI_TEXT_PROVIDER");
  if (envProvider) {
    return {
      provider: normalizeTextProvider(envProvider),
      source: "environment",
    };
  }

  if (values.anthropicKey) {
    return {
      provider: "anthropic",
      source: "default",
    };
  }

  if (values.geminiKey) {
    return {
      provider: "gemini",
      source: "default",
    };
  }

  return {
    provider: DEFAULT_TEXT_PROVIDER,
    source: "default",
  };
}

export async function getAITextProvider(): Promise<AITextProvider> {
  const settings = await listAISettings();
  const storedByKey = new Map(settings.map((item) => [item.key, item]));
  const providerSetting = storedByKey.get("AI_TEXT_PROVIDER")
    ? decryptIntegrationValue(storedByKey.get("AI_TEXT_PROVIDER")!.encryptedValue)
    : null;

  const anthropicKey = storedByKey.get("ANTHROPIC_API_KEY")
    ? decryptIntegrationValue(storedByKey.get("ANTHROPIC_API_KEY")!.encryptedValue)
    : getEnvFallback("ANTHROPIC_API_KEY");
  const geminiKey = storedByKey.get("GEMINI_API_KEY")
    ? decryptIntegrationValue(storedByKey.get("GEMINI_API_KEY")!.encryptedValue)
    : getEnvFallback("GEMINI_API_KEY");

  return getResolvedTextProviderFromValues({
    providerSetting,
    anthropicKey,
    geminiKey,
  }).provider;
}

export async function buildAIFieldStates(): Promise<AIFieldState[]> {
  const settings = await listAISettings();
  const storedByKey = new Map(settings.map((item) => [item.key, item]));
  const storedProvider = storedByKey.get("AI_TEXT_PROVIDER")
    ? decryptIntegrationValue(storedByKey.get("AI_TEXT_PROVIDER")!.encryptedValue)
    : null;
  const storedAnthropic = storedByKey.get("ANTHROPIC_API_KEY")
    ? decryptIntegrationValue(storedByKey.get("ANTHROPIC_API_KEY")!.encryptedValue)
    : getEnvFallback("ANTHROPIC_API_KEY");
  const storedGemini = storedByKey.get("GEMINI_API_KEY")
    ? decryptIntegrationValue(storedByKey.get("GEMINI_API_KEY")!.encryptedValue)
    : getEnvFallback("GEMINI_API_KEY");
  const resolvedTextProvider = getResolvedTextProviderFromValues({
    providerSetting: storedProvider,
    anthropicKey: storedAnthropic,
    geminiKey: storedGemini,
  });

  return AI_FIELD_DEFINITIONS.map((field) => {
    if (field.key === "AI_TEXT_PROVIDER") {
      const stored = storedByKey.get(field.key);
      if (stored) {
        const value = normalizeTextProvider(
          decryptIntegrationValue(stored.encryptedValue)
        );

        return {
          ...field,
          configured: true,
          source: "database" as const,
          value,
          valuePreview: value,
        };
      }

      const envValue = getEnvFallback(field.key);
      if (envValue) {
        const value = normalizeTextProvider(envValue);
        return {
          ...field,
          configured: true,
          source: "environment" as const,
          value,
          valuePreview: value,
        };
      }

      return {
        ...field,
        configured: true,
        source: resolvedTextProvider.source,
        value: resolvedTextProvider.provider,
        valuePreview: resolvedTextProvider.provider,
      };
    }

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
  const requiredFields = fields.filter((field) => field.countInSummary !== false);

  return {
    configuredCount: requiredFields.filter((field) => field.configured).length,
    requiredCount: requiredFields.length,
    missingKeys: requiredFields
      .filter((field) => !field.configured)
      .map((field) => field.key),
  };
}

export async function upsertAISettings(input: {
  userId: string;
  values: Partial<Record<AIProviderKey, string>>;
}) {
  const operations = Object.entries(input.values).flatMap(([key, rawValue]) => {
    const definition = getDefinition(key as AIProviderKey);

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
          isSecret: definition.secret,
          updatedById: input.userId,
        },
        update: {
          encryptedValue: encryptIntegrationValue(value),
          isSecret: definition.secret,
          updatedById: input.userId,
        },
      }),
    ];
  });

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }
}

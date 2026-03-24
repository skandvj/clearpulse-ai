import { Prisma, SignalSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  decryptIntegrationValue,
  encryptIntegrationValue,
} from "@/lib/integrations/crypto";
import {
  INTEGRATION_DEFINITIONS,
  type IntegrationDefinition,
  type IntegrationFieldDefinition,
} from "@/lib/integrations/catalog";

type IntegrationSettingRecord = {
  source: SignalSource;
  key: string;
  encryptedValue: string;
  isSecret: boolean;
};

export type IntegrationValueSource = "database" | "environment" | "missing";

export interface IntegrationFieldState extends IntegrationFieldDefinition {
  configured: boolean;
  source: IntegrationValueSource;
  value: string | null;
  valuePreview: string | null;
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

function getEnvFallback(key: string): string | null {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    return null;
  }

  return value;
}

function resolveFieldState(
  field: IntegrationFieldDefinition,
  storedRecord: IntegrationSettingRecord | null
): IntegrationFieldState {
  if (storedRecord) {
    const decryptedValue = decryptIntegrationValue(storedRecord.encryptedValue);

    return {
      ...field,
      configured: true,
      source: "database",
      value: field.secret ? null : decryptedValue,
      valuePreview: field.secret ? maskValue(decryptedValue) : decryptedValue,
    };
  }

  const envValue = getEnvFallback(field.key);
  if (envValue) {
    return {
      ...field,
      configured: true,
      source: "environment",
      value: field.secret ? null : envValue,
      valuePreview: field.secret ? maskValue(envValue) : envValue,
    };
  }

  return {
    ...field,
    configured: false,
    source: "missing",
    value: null,
    valuePreview: null,
  };
}

export async function listIntegrationSettings(source?: SignalSource) {
  return prisma.integrationSetting.findMany({
    where: source ? { source } : undefined,
    select: {
      source: true,
      key: true,
      encryptedValue: true,
      isSecret: true,
    },
  });
}

export async function getIntegrationRuntimeValues(
  source: SignalSource,
  keys: string[]
): Promise<Record<string, string | undefined>> {
  const records = await listIntegrationSettings(source);
  const byKey = new Map(records.map((record) => [record.key, record]));

  return Object.fromEntries(
    keys.map((key) => {
      const stored = byKey.get(key);
      if (stored) {
        return [key, decryptIntegrationValue(stored.encryptedValue)];
      }

      return [key, process.env[key]];
    })
  );
}

export async function getIntegrationRuntimeValue(
  source: SignalSource,
  key: string
) {
  const values = await getIntegrationRuntimeValues(source, [key]);
  return values[key];
}

export function buildIntegrationFieldStates(
  definition: IntegrationDefinition,
  settings: IntegrationSettingRecord[]
): IntegrationFieldState[] {
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));

  return definition.fields.map((field) =>
    resolveFieldState(field, byKey.get(field.key) ?? null)
  );
}

export function summarizeIntegrationFields(fields: IntegrationFieldState[]) {
  const missingEnv = fields
    .filter((field) => !field.configured)
    .map((field) => field.key);

  return {
    configuredCount: fields.filter((field) => field.configured).length,
    requiredCount: fields.length,
    missingEnv,
  };
}

export async function upsertIntegrationSettings(input: {
  source: SignalSource;
  values: Record<string, string>;
  userId: string;
}) {
  const definition = INTEGRATION_DEFINITIONS[input.source];
  const editableKeys = new Set(
    definition.fields
      .filter((field) => field.browserEditable)
      .map((field) => field.key)
  );

  const operations: Prisma.PrismaPromise<unknown>[] = [];

  for (const [key, rawValue] of Object.entries(input.values)) {
    if (!editableKeys.has(key)) {
      continue;
    }

    const field = definition.fields.find((item) => item.key === key);
    if (!field) continue;

    const value = rawValue.trim();
    if (field.secret && value.length === 0) {
      continue;
    }

    if (!field.secret && value.length === 0) {
      operations.push(
        prisma.integrationSetting.deleteMany({
          where: {
            source: input.source,
            key,
          },
        })
      );
      continue;
    }

    operations.push(
      prisma.integrationSetting.upsert({
        where: {
          source_key: {
            source: input.source,
            key,
          },
        },
        create: {
          source: input.source,
          key,
          encryptedValue: encryptIntegrationValue(value),
          isSecret: field.secret,
          updatedById: input.userId,
        },
        update: {
          encryptedValue: encryptIntegrationValue(value),
          isSecret: field.secret,
          updatedById: input.userId,
        },
      })
    );
  }

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }
}

import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";

export type KpiFrameworkSettingKey =
  | "WORKING_KPI_MIN_EVIDENCE_COUNT"
  | "REQUIRE_EXPLICIT_METRIC_FOR_WORKING_KPI"
  | "ALLOW_BLOCKER_PROMOTION"
  | "FATHOM_SINGLE_SIGNAL_DEFAULT";

export type FathomSingleSignalDefault = "suggested" | "working";

export interface KpiFrameworkRuntimeSettings {
  workingKpiMinEvidenceCount: number;
  requireExplicitMetricForWorkingKpi: boolean;
  allowBlockerPromotion: boolean;
  fathomSingleSignalDefault: FathomSingleSignalDefault;
}

export type KpiFrameworkSettingField = {
  key: KpiFrameworkSettingKey;
  label: string;
  description: string;
  inputType: "number" | "switch" | "select";
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string }>;
  value: number | boolean | string;
  defaultValue: number | boolean | string;
};

const DEFAULT_KPI_FRAMEWORK_SETTINGS: KpiFrameworkRuntimeSettings = {
  workingKpiMinEvidenceCount: 2,
  requireExplicitMetricForWorkingKpi: false,
  allowBlockerPromotion: false,
  fathomSingleSignalDefault: "suggested",
};

const SETTING_DEFINITIONS: Array<{
  key: KpiFrameworkSettingKey;
  label: string;
  description: string;
  inputType: "number" | "switch" | "select";
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string }>;
  defaultValue: number | boolean | string;
}> = [
  {
    key: "WORKING_KPI_MIN_EVIDENCE_COUNT",
    label: "Working KPI evidence threshold",
    description:
      "Minimum supporting signals needed before discussion-driven evidence becomes a working KPI.",
    inputType: "number",
    min: 1,
    max: 5,
    defaultValue: DEFAULT_KPI_FRAMEWORK_SETTINGS.workingKpiMinEvidenceCount,
  },
  {
    key: "REQUIRE_EXPLICIT_METRIC_FOR_WORKING_KPI",
    label: "Require explicit metric or target",
    description:
      "If enabled, a working KPI must include a stated target or current value rather than only repeated discussion.",
    inputType: "switch",
    defaultValue:
      DEFAULT_KPI_FRAMEWORK_SETTINGS.requireExplicitMetricForWorkingKpi,
  },
  {
    key: "ALLOW_BLOCKER_PROMOTION",
    label: "Allow blocker promotion",
    description:
      "If enabled, blockers that are clearly framed as success conditions can be elevated into working KPIs after review.",
    inputType: "switch",
    defaultValue: DEFAULT_KPI_FRAMEWORK_SETTINGS.allowBlockerPromotion,
  },
  {
    key: "FATHOM_SINGLE_SIGNAL_DEFAULT",
    label: "Single-signal Fathom default",
    description:
      "Choose how a single uncorroborated Fathom KPI candidate should appear before more evidence exists.",
    inputType: "select",
    options: [
      { label: "Suggested", value: "suggested" },
      { label: "Working", value: "working" },
    ],
    defaultValue: DEFAULT_KPI_FRAMEWORK_SETTINGS.fathomSingleSignalDefault,
  },
];

function frameworkDir() {
  return path.join(process.cwd(), "docs", "kpi-framework");
}

function parseBoolean(value: string | null | undefined, fallback: boolean) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function parseNumber(value: string | null | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSelect<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  if (!value) return fallback;
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export async function getKpiFrameworkSettings(
  organizationId: string
): Promise<KpiFrameworkRuntimeSettings> {
  const records = await prisma.kpiFrameworkSetting.findMany({
    where: { organizationId },
    select: { key: true, value: true },
  });
  const byKey = new Map(records.map((record) => [record.key, record.value]));

  return {
    workingKpiMinEvidenceCount: Math.max(
      1,
      Math.min(
        5,
        parseNumber(
          byKey.get("WORKING_KPI_MIN_EVIDENCE_COUNT"),
          DEFAULT_KPI_FRAMEWORK_SETTINGS.workingKpiMinEvidenceCount
        )
      )
    ),
    requireExplicitMetricForWorkingKpi: parseBoolean(
      byKey.get("REQUIRE_EXPLICIT_METRIC_FOR_WORKING_KPI"),
      DEFAULT_KPI_FRAMEWORK_SETTINGS.requireExplicitMetricForWorkingKpi
    ),
    allowBlockerPromotion: parseBoolean(
      byKey.get("ALLOW_BLOCKER_PROMOTION"),
      DEFAULT_KPI_FRAMEWORK_SETTINGS.allowBlockerPromotion
    ),
    fathomSingleSignalDefault: parseSelect(
      byKey.get("FATHOM_SINGLE_SIGNAL_DEFAULT"),
      ["suggested", "working"] as const,
      DEFAULT_KPI_FRAMEWORK_SETTINGS.fathomSingleSignalDefault
    ),
  };
}

export async function buildKpiFrameworkFieldStates(
  organizationId: string
): Promise<KpiFrameworkSettingField[]> {
  const settings = await getKpiFrameworkSettings(organizationId);

  return SETTING_DEFINITIONS.map((definition) => {
    let value: number | boolean | string = definition.defaultValue;

    switch (definition.key) {
      case "WORKING_KPI_MIN_EVIDENCE_COUNT":
        value = settings.workingKpiMinEvidenceCount;
        break;
      case "REQUIRE_EXPLICIT_METRIC_FOR_WORKING_KPI":
        value = settings.requireExplicitMetricForWorkingKpi;
        break;
      case "ALLOW_BLOCKER_PROMOTION":
        value = settings.allowBlockerPromotion;
        break;
      case "FATHOM_SINGLE_SIGNAL_DEFAULT":
        value = settings.fathomSingleSignalDefault;
        break;
    }

    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      inputType: definition.inputType,
      min: definition.min,
      max: definition.max,
      options: definition.options,
      value,
      defaultValue: definition.defaultValue,
    };
  });
}

export async function upsertKpiFrameworkSettings(args: {
  organizationId: string;
  userId: string;
  values: Partial<Record<KpiFrameworkSettingKey, string | number | boolean>>;
}) {
  const entries = Object.entries(args.values).filter(
    (entry): entry is [KpiFrameworkSettingKey, string | number | boolean] =>
      entry[1] !== undefined
  );

  await Promise.all(
    entries.map(([key, value]) =>
      prisma.kpiFrameworkSetting.upsert({
        where: {
          organizationId_key: {
            organizationId: args.organizationId,
            key,
          },
        },
        create: {
          organizationId: args.organizationId,
          key,
          value: String(value),
          updatedById: args.userId,
        },
        update: {
          value: String(value),
          updatedById: args.userId,
        },
      })
    )
  );
}

type CsvRow = Record<string, string>;

async function parseCsvFile(fileName: string): Promise<CsvRow[]> {
  const raw = await fs.readFile(path.join(frameworkDir(), fileName), "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = lines[0].split(",");

  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return headers.reduce<CsvRow>((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  });
}

export async function loadKpiFrameworkReferenceData() {
  const [policyMatrix, sourceCoverage, examples, fathomProfile] =
    await Promise.all([
      parseCsvFile("02-kpi-policy-matrix.csv"),
      parseCsvFile("03-source-coverage-matrix.csv"),
      parseCsvFile("04-example-evaluation-set.csv"),
      parseCsvFile("05-fathom-first-profile.csv"),
    ]);

  return {
    policyMatrix,
    sourceCoverage,
    examples,
    fathomProfile,
  };
}

export { DEFAULT_KPI_FRAMEWORK_SETTINGS };

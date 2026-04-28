import type { KpiFrameworkRuntimeSettings } from "@/lib/kpi-framework";

export type DerivedKpiType = "MANUAL" | "DOCUMENTED" | "WORKING" | "SUGGESTED";

export const KPI_TYPE_ORDER: DerivedKpiType[] = [
  "DOCUMENTED",
  "WORKING",
  "SUGGESTED",
  "MANUAL",
];

const DOCUMENTED_SOURCES = new Set([
  "VITALLY",
  "SALESFORCE",
  "SHAREPOINT",
  "GOOGLE_DRIVE",
]);

const CONVERSATION_SOURCES = new Set(["FATHOM", "SLACK", "AM_MEETING"]);

export function dedupeSignalSources(sources: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      sources
        .map((source) => source?.trim())
        .filter((source): source is string => Boolean(source))
    )
  );
}

type DeriveKpiTypeInput = {
  source: string | null;
  targetValue: string | null;
  currentValue: string | null;
  evidenceSources?: string[];
  evidenceCount?: number;
  overrideType?: DerivedKpiType | null;
  overrideNote?: string | null;
  settings?: KpiFrameworkRuntimeSettings;
};

function hasValue(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export function deriveKpiType({
  source,
  targetValue,
  currentValue,
  evidenceSources = [],
  evidenceCount = 0,
  overrideType,
  settings,
}: DeriveKpiTypeInput): DerivedKpiType {
  if (overrideType) {
    return overrideType;
  }

  if (source === "MANUAL") {
    return "MANUAL";
  }

  const normalizedEvidenceSources = dedupeSignalSources(evidenceSources);
  const hasDocumentedEvidence = normalizedEvidenceSources.some((item) =>
    DOCUMENTED_SOURCES.has(item)
  );

  if (hasDocumentedEvidence) {
    return "DOCUMENTED";
  }

  const hasConversationEvidence = normalizedEvidenceSources.some((item) =>
    CONVERSATION_SOURCES.has(item)
  );
  const hasExplicitMetric = hasValue(targetValue) || hasValue(currentValue);
  const minEvidenceCount = settings?.workingKpiMinEvidenceCount ?? 2;
  const requireExplicitMetric =
    settings?.requireExplicitMetricForWorkingKpi ?? false;

  const meetsWorkingThreshold = evidenceCount >= minEvidenceCount;
  const canPromoteToWorking = requireExplicitMetric
    ? hasExplicitMetric && meetsWorkingThreshold
    : hasExplicitMetric || meetsWorkingThreshold;

  if (hasConversationEvidence && canPromoteToWorking) {
    return "WORKING";
  }

  if (
    hasConversationEvidence &&
    normalizedEvidenceSources.length === 1 &&
    normalizedEvidenceSources[0] === "FATHOM" &&
    settings?.fathomSingleSignalDefault === "working"
  ) {
    return "WORKING";
  }

  return "SUGGESTED";
}

export function deriveKpiClassification({
  source,
  targetValue,
  currentValue,
  evidenceSources = [],
  evidenceCount = 0,
  overrideType,
  overrideNote,
  settings,
}: DeriveKpiTypeInput) {
  const normalizedEvidenceSources = dedupeSignalSources(evidenceSources);
  const type = deriveKpiType({
    source,
    targetValue,
    currentValue,
    evidenceSources: normalizedEvidenceSources,
    evidenceCount,
    overrideType,
    overrideNote,
    settings,
  });

  const hasDocumentedEvidence = normalizedEvidenceSources.some((item) =>
    DOCUMENTED_SOURCES.has(item)
  );
  const hasConversationEvidence = normalizedEvidenceSources.some((item) =>
    CONVERSATION_SOURCES.has(item)
  );
  const hasExplicitMetric = hasValue(targetValue) || hasValue(currentValue);

  const reasons: string[] = [];

  if (overrideType) {
    reasons.push(`Classification manually overridden to ${overrideType.toLowerCase()}.`);
  } else if (source === "MANUAL") {
    reasons.push("Created manually by the team.");
  } else if (hasDocumentedEvidence) {
    reasons.push(
      "Supported by at least one documented source such as Vitally, Salesforce, SharePoint, or Google Drive."
    );
  } else if (hasConversationEvidence) {
    reasons.push("Driven by conversation evidence rather than a formal system of record.");

    if (hasExplicitMetric) {
      reasons.push("Includes an explicit target or current metric value.");
    } else {
      reasons.push("Does not yet include a clearly stated target or current metric value.");
    }

    reasons.push(
      `Currently backed by ${evidenceCount} signal${evidenceCount === 1 ? "" : "s"}.`
    );
  } else {
    reasons.push("Evidence is thin or not strongly attributable to a supported KPI source.");
  }

  if (overrideNote?.trim()) {
    reasons.push(`Reviewer note: ${overrideNote.trim()}`);
  }

  return {
    type,
    reason: reasons.join(" "),
    evidenceSources: normalizedEvidenceSources,
    hasDocumentedEvidence,
    hasConversationEvidence,
    hasExplicitMetric,
  };
}

export function getKpiTypeMeta(type: DerivedKpiType) {
  switch (type) {
    case "DOCUMENTED":
      return {
        label: "Documented",
        description:
          "Supported by a system-of-record or account document source.",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
      };
    case "WORKING":
      return {
        label: "Working",
        description:
          "Clear KPI discussed in workflow, but not yet formally documented.",
        className:
          "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
      };
    case "SUGGESTED":
      return {
        label: "Suggested",
        description:
          "Potential KPI with thin or discussion-only evidence that still needs review.",
        className:
          "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100",
      };
    case "MANUAL":
      return {
        label: "Manual",
        description: "Created or maintained directly by the team.",
        className:
          "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50",
      };
  }
}

export function getKpiTypeRank(type: DerivedKpiType) {
  const index = KPI_TYPE_ORDER.indexOf(type);
  return index === -1 ? KPI_TYPE_ORDER.length : index;
}

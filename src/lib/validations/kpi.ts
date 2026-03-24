import { z } from "zod";

const kpiCategoryValues = [
  "DEFLECTION",
  "EFFICIENCY",
  "ADOPTION",
  "REVENUE",
  "SATISFACTION",
  "RETENTION",
  "CUSTOM",
] as const;

const kpiSourceValues = [
  "MANUAL",
  "AI_EXTRACTED",
  "VITALLY_SYNC",
  "FATHOM_SYNC",
  "SLACK_SIGNAL",
  "SALESFORCE_SYNC",
  "JIRA_SYNC",
  "GDRIVE_SIGNAL",
  "SHAREPOINT_SIGNAL",
] as const;

const kpiStatusValues = ["ON_TRACK", "AT_RISK", "ACHIEVED", "MISSED"] as const;

const healthStatusValues = ["HEALTHY", "AT_RISK", "CRITICAL", "UNKNOWN"] as const;

const healthTrendValues = ["IMPROVING", "STABLE", "DECLINING"] as const;

export const createKPISchema = z.object({
  metricName: z.string().min(1, "Metric name is required").max(255),
  targetValue: z.string().optional(),
  currentValue: z.string().optional(),
  unit: z.string().max(50).optional(),
  category: z.enum(kpiCategoryValues),
  source: z.enum(kpiSourceValues).optional(),
  status: z.enum(kpiStatusValues).optional(),
  notes: z.string().optional(),
});

export const updateKPISchema = z.object({
  metricName: z.string().min(1).max(255).optional(),
  targetValue: z.string().nullable().optional(),
  currentValue: z.string().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  category: z.enum(kpiCategoryValues).optional(),
  source: z.enum(kpiSourceValues).optional(),
  status: z.enum(kpiStatusValues).optional(),
  notes: z.string().nullable().optional(),
  healthScore: z.number().min(0).max(100).nullable().optional(),
  healthStatus: z.enum(healthStatusValues).optional(),
  healthNarrative: z.string().nullable().optional(),
  healthTrend: z.enum(healthTrendValues).optional(),
});

export type CreateKPIInput = z.infer<typeof createKPISchema>;
export type UpdateKPIInput = z.infer<typeof updateKPISchema>;

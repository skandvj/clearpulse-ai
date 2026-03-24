import { z } from "zod";

export const createAccountSchema = z.object({
  name: z.string().min(1, "Account name is required").max(255),
  domain: z.string().max(255).optional(),
  tier: z.string().max(100).optional(),
  industry: z.string().max(100).optional(),
  csmId: z.string().optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  domain: z.string().max(255).optional(),
  tier: z.string().max(100).nullable().optional(),
  industry: z.string().max(100).optional(),
  csmId: z.string().nullable().optional(),
  currentSolution: z.string().optional(),
  currentState: z.string().optional(),
  businessGoals: z.string().optional(),
  objectives: z.string().optional(),
  roadblocks: z.string().optional(),
  implementationPlan: z.string().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

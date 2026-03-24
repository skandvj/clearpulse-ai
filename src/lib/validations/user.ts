import { z } from "zod";

const roleValues = ["ADMIN", "LEADERSHIP", "CSM", "VIEWER"] as const;

export const createUserSchema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email address"),
  role: z.enum(roleValues),
  password: z
    .string()
    .max(128, "Password must be 128 characters or fewer")
    .optional()
    .or(z.literal("")),
});

export const updateUserSchema = z
  .object({
    role: z.enum(roleValues).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.role !== undefined || value.isActive !== undefined, {
    message: "Provide at least one field to update",
  });

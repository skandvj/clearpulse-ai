import { z } from "zod";

export const createContactSchema = z.object({
  name: z.string().min(1, "Contact name is required").max(255),
  role: z.string().max(255).optional(),
  email: z.string().email("Invalid email address").optional(),
  isPrimary: z.boolean().optional(),
});

export const updateContactSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: z.string().max(255).nullable().optional(),
  email: z.string().email("Invalid email address").nullable().optional(),
  isPrimary: z.boolean().optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

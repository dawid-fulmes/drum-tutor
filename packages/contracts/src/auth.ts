import { z } from "zod";

/** Normalized email (ADR-0024): trimmed and lowercased before format validation. */
export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const LoginRequestSchema = z.object({
  email: EmailSchema,
});
export type LoginRequest = z.input<typeof LoginRequestSchema>;

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  createdAt: z.iso.datetime(),
});
export type User = z.infer<typeof UserSchema>;

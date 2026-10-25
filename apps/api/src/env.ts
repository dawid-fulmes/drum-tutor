import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.url(),
  COOKIE_SECRET: z.string().min(32),
  API_PORT: z.coerce.number().int().positive().default(3330),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

/** Validates the API environment and fails fast with every invalid variable named. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  return result.data;
}

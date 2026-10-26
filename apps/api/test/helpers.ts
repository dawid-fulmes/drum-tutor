import { createDb, type Database } from "@drum-tutor/db";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { inject } from "vitest";
import { buildApp } from "../src/app";

export const TEST_COOKIE_SECRET = "test-cookie-secret-0123456789-abcdefghij";

export async function createTestApp(
  options: { databaseUrl?: string; beforeReady?: (app: FastifyInstance) => Promise<void> } = {},
): Promise<{ app: FastifyInstance; db: Database; close(): Promise<void> }> {
  const { db, close: closeDb } = createDb(options.databaseUrl ?? inject("databaseUrl"));
  const app = await buildApp({ db, cookieSecret: TEST_COOKIE_SECRET, isProduction: false });
  await options.beforeReady?.(app);
  await app.ready();
  return {
    app,
    db,
    close: async () => {
      await app.close();
      await closeDb();
    },
  };
}

export async function resetDatabase(db: Database): Promise<void> {
  await db.execute(
    sql`TRUNCATE users, tags, lessons, lesson_tags, practice_logs, lesson_ratings CASCADE`,
  );
}

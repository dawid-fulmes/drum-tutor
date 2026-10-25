import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "./client";

const migrationsFolder = path.resolve(import.meta.dirname, "../migrations");

/** Applies pending migrations. Shared by the CLI and the integration tests. */
export async function runMigrations(connectionString: string): Promise<void> {
  const { db, close } = createDb(connectionString);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await close();
  }
}

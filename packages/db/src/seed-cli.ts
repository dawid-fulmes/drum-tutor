import { createDb } from "./client";
import { loadRootEnv } from "./load-env";
import { seedDatabase } from "./seed";

loadRootEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env in the repo root.");
  process.exit(1);
}

const { db, close } = createDb(url);
try {
  await seedDatabase(db);
  console.log("Seed data loaded.");
} catch (error) {
  console.error("Seeding failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await close();
}

import { loadRootEnv } from "./load-env";
import { runMigrations } from "./migrate";

loadRootEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env in the repo root.");
  process.exit(1);
}

try {
  await runMigrations(url);
  console.log("Migrations applied.");
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
}

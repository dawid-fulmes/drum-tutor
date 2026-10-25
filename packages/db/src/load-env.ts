import { existsSync } from "node:fs";
import path from "node:path";

const rootEnvFile = path.resolve(import.meta.dirname, "../../../.env");

/** Loads the repo-root .env into process.env when it exists. Already set variables win. */
export function loadRootEnv(): void {
  if (existsSync(rootEnvFile)) {
    process.loadEnvFile(rootEnvFile);
  }
}

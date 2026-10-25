import { runMigrations } from "@drum-tutor/db";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer("postgres:18.6-alpine").start();
  const databaseUrl = container.getConnectionUri();
  await runMigrations(databaseUrl);
  project.provide("databaseUrl", databaseUrl);

  return async () => {
    await container.stop();
  };
}

import { randomUUID } from "node:crypto";
import { ApiErrorSchema, ApiPaths } from "@drum-tutor/contracts";
import { createDb } from "@drum-tutor/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { createTestApp } from "../../../test/helpers";

describe("health", () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.close();
  });

  it("GET /api/health returns ok", async () => {
    const res = await ctx.app.inject({ method: "GET", url: ApiPaths.health });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("returns 503 SERVICE_UNAVAILABLE when the database is unreachable", async () => {
    const down = await createTestApp({ databaseUrl: "postgres://u:p@127.0.0.1:1/none" });
    try {
      const res = await down.app.inject({ method: "GET", url: ApiPaths.health });
      expect(res.statusCode).toBe(503);
      expect(ApiErrorSchema.parse(res.json()).error.code).toBe("SERVICE_UNAVAILABLE");
    } finally {
      await down.close();
    }
  });

  it("returns 503 (not 500) for a logged-in browser when the database is unreachable", async () => {
    const down = await createTestApp({ databaseUrl: "postgres://u:p@127.0.0.1:1/none" });
    try {
      const res = await down.app.inject({
        method: "GET",
        url: ApiPaths.health,
        cookies: { dt_session: down.app.signCookie(randomUUID()) },
      });
      expect(res.statusCode).toBe(503);
    } finally {
      await down.close();
    }
  });

  it("keeps serving after the database drops its connections", async () => {
    expect((await ctx.app.inject({ method: "GET", url: ApiPaths.health })).statusCode).toBe(200);
    const admin = createDb(inject("databaseUrl"));
    try {
      await admin.db.execute(
        sql`select pg_terminate_backend(pid) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()`,
      );
    } finally {
      await admin.close();
    }
    await new Promise((resolve) => setTimeout(resolve, 200));

    const res = await ctx.app.inject({ method: "GET", url: ApiPaths.health });
    expect(res.statusCode).toBe(200);
  });

  it("serves the OpenAPI document with the registered paths", async () => {
    const res = await ctx.app.inject({ method: "GET", url: `${ApiPaths.docs}/json` });
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json().paths)).toContain(ApiPaths.health);
  });
});

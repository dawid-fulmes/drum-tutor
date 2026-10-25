import { ApiErrorSchema } from "@drum-tutor/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestApp } from "../../test/helpers";

async function registerTestRoutes(app: FastifyInstance) {
  await app.register(async (scope) => {
    const typed = scope.withTypeProvider<ZodTypeProvider>();
    typed.post(
      "/api/test/echo",
      { schema: { body: z.object({ name: z.string().min(1) }) } },
      async (request) => request.body,
    );
    typed.get("/api/test/boom", async () => {
      throw new Error("secret detail");
    });
  });
}

describe("error handler", () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    ctx = await createTestApp({ beforeReady: registerTestRoutes });
  });
  afterAll(async () => {
    await ctx.close();
  });

  it("unknown route → 404 NOT_FOUND in ApiError shape", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/nope" });
    expect(res.statusCode).toBe(404);
    expect(ApiErrorSchema.parse(res.json()).error.code).toBe("NOT_FOUND");
  });

  it("malformed JSON body → 400 BAD_REQUEST in ApiError shape", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/test/echo",
      headers: { "content-type": "application/json" },
      payload: "{",
    });
    expect(res.statusCode).toBe(400);
    expect(ApiErrorSchema.parse(res.json()).error.code).toBe("BAD_REQUEST");
  });

  it("unsupported content type → 4xx BAD_REQUEST in ApiError shape", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/test/echo",
      headers: { "content-type": "application/xml" },
      payload: "<name>x</name>",
    });
    expect(res.statusCode).toBe(415);
    expect(ApiErrorSchema.parse(res.json()).error.code).toBe("BAD_REQUEST");
  });

  it("unhandled error → 500 INTERNAL_ERROR with a generic message", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/test/boom" });
    expect(res.statusCode).toBe(500);
    const body = ApiErrorSchema.parse(res.json());
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).not.toContain("secret detail");
  });

  it("schema validation failure → 400 VALIDATION_ERROR with details[].path", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/test/echo",
      payload: { name: "" },
    });
    expect(res.statusCode).toBe(400);
    const body = ApiErrorSchema.parse(res.json());
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details?.[0]?.path).toContain("name");
  });
});

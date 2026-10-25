import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

describe("loadEnv", () => {
  it("lists every invalid variable", () => {
    expect(() => loadEnv({ DATABASE_URL: "nope" })).toThrow(/DATABASE_URL[\s\S]*COOKIE_SECRET/);
  });

  it("defaults API_PORT to 3330 and NODE_ENV to development", () => {
    const env = loadEnv({
      DATABASE_URL: "postgres://u:p@localhost:5432/db",
      COOKIE_SECRET: "x".repeat(32),
    });
    expect(env.API_PORT).toBe(3330);
    expect(env.NODE_ENV).toBe("development");
  });
});

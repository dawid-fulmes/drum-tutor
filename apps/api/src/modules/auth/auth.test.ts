import { ApiErrorSchema, ApiPaths, UserSchema } from "@drum-tutor/contracts";
import { users } from "@drum-tutor/db";
import { eq } from "drizzle-orm";
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, resetDatabase } from "../../../test/helpers";

const SESSION_COOKIE = "dt_session";
const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

describe("auth", () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.db);
  });

  const login = (email: string) =>
    ctx.app.inject({ method: "POST", url: ApiPaths.login, payload: { email } });
  const me = (cookie?: string) =>
    ctx.app.inject({
      method: "GET",
      url: ApiPaths.me,
      cookies: cookie === undefined ? {} : { [SESSION_COOKIE]: cookie },
    });
  const logout = (cookie?: string) =>
    ctx.app.inject({
      method: "POST",
      url: ApiPaths.logout,
      cookies: cookie === undefined ? {} : { [SESSION_COOKIE]: cookie },
    });
  const sessionCookie = (res: LightMyRequestResponse) =>
    res.cookies.find((cookie) => cookie.name === SESSION_COOKIE);
  const isCleared = (res: LightMyRequestResponse) => {
    const cookie = sessionCookie(res);
    if (!cookie) return false;
    return (
      cookie.value === "" &&
      (cookie.maxAge === 0 ||
        (cookie.expires !== undefined && new Date(cookie.expires) <= new Date()))
    );
  };
  const countUsers = async () => (await ctx.db.select().from(users)).length;

  it("login with a new email creates exactly one user and sets a session cookie", async () => {
    const res = await login("new@example.com");

    expect(res.statusCode).toBe(200);
    const user = UserSchema.parse(res.json());
    expect(user.email).toBe("new@example.com");
    expect(await countUsers()).toBe(1);
    const cookie = sessionCookie(res);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.maxAge).toBe(THIRTY_DAYS_IN_SECONDS);
    expect(cookie?.path).toBe("/");
  });

  it("login with the same email in another case and with spaces returns the same user", async () => {
    const first = UserSchema.parse((await login("anna@example.com")).json());
    const secondRes = await login("  ANNA@Example.com ");

    expect(secondRes.statusCode).toBe(200);
    expect(UserSchema.parse(secondRes.json()).id).toBe(first.id);
    expect(await countUsers()).toBe(1);
  });

  it("two concurrent first logins create one user", async () => {
    const [a, b] = await Promise.all([login("race@example.com"), login("race@example.com")]);

    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(UserSchema.parse(a.json()).id).toBe(UserSchema.parse(b.json()).id);
    expect(await countUsers()).toBe(1);
  });

  it("invalid email → 400 VALIDATION_ERROR with details", async () => {
    const res = await login("not-an-email");

    expect(res.statusCode).toBe(400);
    const body = ApiErrorSchema.parse(res.json());
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details?.[0]?.path).toContain("email");
    expect(await countUsers()).toBe(0);
  });

  it("missing body → 400 in ApiError shape", async () => {
    const res = await ctx.app.inject({ method: "POST", url: ApiPaths.login });

    expect(res.statusCode).toBe(400);
    ApiErrorSchema.parse(res.json());
  });

  it("me with the login cookie returns the user", async () => {
    const loginRes = await login("me@example.com");
    const res = await me(sessionCookie(loginRes)?.value);

    expect(res.statusCode).toBe(200);
    expect(UserSchema.parse(res.json())).toEqual(UserSchema.parse(loginRes.json()));
  });

  it("me without a cookie → 401 UNAUTHENTICATED", async () => {
    const res = await me();

    expect(res.statusCode).toBe(401);
    expect(ApiErrorSchema.parse(res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("me with a tampered cookie → 401", async () => {
    const value = sessionCookie(await login("tamper@example.com"))?.value ?? "";
    const tampered = value.slice(0, -1) + (value.endsWith("A") ? "B" : "A");

    const res = await me(tampered);

    expect(res.statusCode).toBe(401);
  });

  it("me with a correctly signed non-UUID value → 401, not 500", async () => {
    const res = await me(ctx.app.signCookie("not-a-uuid"));

    expect(res.statusCode).toBe(401);
    expect(ApiErrorSchema.parse(res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("me for a deleted user → 401 and clears the cookie", async () => {
    const loginRes = await login("gone@example.com");
    await ctx.db.delete(users).where(eq(users.email, "gone@example.com"));

    const res = await me(sessionCookie(loginRes)?.value);

    expect(res.statusCode).toBe(401);
    expect(isCleared(res)).toBe(true);
  });

  it("logout → 204 and clears the cookie; me afterwards → 401", async () => {
    const value = sessionCookie(await login("bye@example.com"))?.value;

    const res = await logout(value);

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe("");
    expect(isCleared(res)).toBe(true);
    expect((await me(sessionCookie(res)?.value)).statusCode).toBe(401);
  });

  it("logout with a session cookie → 204 even when the database is unreachable", async () => {
    const down = await createTestApp({ databaseUrl: "postgres://u:p@127.0.0.1:1/none" });
    try {
      const res = await down.app.inject({
        method: "POST",
        url: ApiPaths.logout,
        cookies: { [SESSION_COOKIE]: down.app.signCookie("00000000-0000-4000-8000-000000000000") },
      });
      expect(res.statusCode).toBe(204);
    } finally {
      await down.close();
    }
  });

  it("logout without a session → 204", async () => {
    const res = await logout();

    expect(res.statusCode).toBe(204);
  });

  it("OpenAPI document lists the auth paths", async () => {
    const res = await ctx.app.inject({ method: "GET", url: `${ApiPaths.docs}/json` });
    const paths = Object.keys(res.json().paths);

    expect(paths).toEqual(expect.arrayContaining([ApiPaths.login, ApiPaths.me, ApiPaths.logout]));
  });
});

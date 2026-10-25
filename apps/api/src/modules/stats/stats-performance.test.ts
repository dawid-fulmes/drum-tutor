import { randomUUID } from "node:crypto";
import { ApiPaths, WeeklyStatsSchema } from "@drum-tutor/contracts";
import { type NewPracticeLogRow, practiceLogs } from "@drum-tutor/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertLesson, insertTag, insertUser, loginCookies } from "../../../test/fixtures";
import { createTestApp, resetDatabase } from "../../../test/helpers";

// Spec §5.3 / ADR-0048: aggregating on read stays fast for a very active drummer.
const LOGS_PER_DAY = 20;
const DURATION_SECONDS = 180;
const BUDGET_MS = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

describe("stats performance", () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let cookies: Record<string, string>;
  let tagId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.db);
    const email = "busy@example.com";
    cookies = await loginCookies(ctx.app, email);
    const busy = await insertUser(ctx.db, email);
    const other = await insertUser(ctx.db, "other@example.com");

    const tag = await insertTag(ctx.db, "Hand speed");
    tagId = tag.id;
    const lessonIds: string[] = [];
    for (const name of ["Weak hand", "Rudiments", "Groove"]) {
      const second = await insertTag(ctx.db, name);
      const lesson = await insertLesson(ctx.db, {
        status: "published",
        tagIds: [tag.id, second.id],
      });
      lessonIds.push(lesson.id);
    }

    const rows: NewPracticeLogRow[] = [];
    const start = Date.UTC(2025, 0, 1);
    for (let day = 0; day < 365; day++) {
      const date = new Date(start + day * DAY_MS);
      for (let i = 0; i < LOGS_PER_DAY; i++) {
        rows.push({
          userId: busy.id,
          lessonId: lessonIds[i % lessonIds.length] as string,
          durationSeconds: DURATION_SECONDS,
          tempoBpm: 90,
          completedAt: date,
          localDate: date.toISOString().slice(0, 10),
          idempotencyKey: randomUUID(),
        });
      }
    }
    for (let i = 0; i < 1000; i++) {
      const date = new Date(start + (i % 365) * DAY_MS);
      rows.push({
        userId: other.id,
        lessonId: lessonIds[0] as string,
        durationSeconds: DURATION_SECONDS,
        tempoBpm: 90,
        completedAt: date,
        localDate: date.toISOString().slice(0, 10),
        idempotencyKey: randomUUID(),
      });
    }
    for (let i = 0; i < rows.length; i += 1000) {
      await ctx.db.insert(practiceLogs).values(rows.slice(i, i + 1000));
    }
    await ctx.db.execute("analyze practice_logs");
  });
  afterAll(async () => {
    await ctx.close();
  });

  it(`returns a year of weekly stats within ${BUDGET_MS} ms`, async () => {
    const url = `${ApiPaths.statsWeekly}?tagId=${tagId}&from=2025-01-01&to=2025-12-31`;
    await ctx.app.inject({ method: "GET", url, cookies }); // warm-up

    const started = performance.now();
    const res = await ctx.app.inject({ method: "GET", url, cookies });
    const elapsed = performance.now() - started;

    expect(res.statusCode).toBe(200);
    const stats = WeeklyStatsSchema.parse(res.json());
    const total = stats.weeks.reduce((sum, week) => sum + week.seconds, 0);
    expect(total).toBe(365 * LOGS_PER_DAY * DURATION_SECONDS);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});

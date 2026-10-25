import {
  ApiErrorCode,
  type DailyStats,
  type StatsQuery,
  type WeeklyStats,
} from "@drum-tutor/contracts";
import { type Database, tags } from "@drum-tutor/db";
import { eq, sql } from "drizzle-orm";
import { AppError } from "../../plugins/error-handler";

async function assertTagExists(db: Database, tagId: string): Promise<void> {
  const [tag] = await db.select({ id: tags.id }).from(tags).where(eq(tags.id, tagId));
  if (!tag) throw new AppError(404, ApiErrorCode.NOT_FOUND, "Tag not found");
}

/*
 * Stats are aggregated on read, one query per request (spec §5.3, ADR-0048). The user's logs in the
 * range come from the (user_id, local_date) index, the join keeps logs whose lesson has the tag
 * (full duration per tag, R6), and generate_series fills days without practice with 0.
 *
 * Dates are cast to timestamp (without time zone) before generate_series / date_trunc: on a bare
 * date Postgres picks the timestamptz overloads, which depend on the session time zone. Results
 * are returned as text and int, because node-postgres turns `date` into a JS Date in the server's
 * zone and `bigint` sums into strings.
 */
const taggedLogs = (userId: string, q: StatsQuery) => sql`
  select pl.local_date, pl.duration_seconds
  from practice_logs pl
  join lesson_tags lt on lt.lesson_id = pl.lesson_id and lt.tag_id = ${q.tagId}
  where pl.user_id = ${userId}
    and pl.local_date between ${q.from}::date and ${q.to}::date
`;

export async function getDailyStats(
  db: Database,
  userId: string,
  q: StatsQuery,
): Promise<DailyStats> {
  await assertTagExists(db, q.tagId);
  const result = await db.execute<{ date: string; seconds: number }>(sql`
    select to_char(g.day, 'YYYY-MM-DD') as date, coalesce(s.seconds, 0)::int as seconds
    from generate_series(${q.from}::date::timestamp, ${q.to}::date::timestamp, interval '1 day') as g(day)
    left join (
      select l.local_date, sum(l.duration_seconds) as seconds
      from (${taggedLogs(userId, q)}) as l
      group by l.local_date
    ) as s on s.local_date = g.day::date
    order by g.day
  `);
  return { tagId: q.tagId, from: q.from, to: q.to, days: result.rows };
}

/** Monday–Sunday weeks, clipped to [from, to] (ADR-0041). */
export async function getWeeklyStats(
  db: Database,
  userId: string,
  q: StatsQuery,
): Promise<WeeklyStats> {
  await assertTagExists(db, q.tagId);
  const result = await db.execute<{ from: string; to: string; seconds: number }>(sql`
    select to_char(greatest(g.monday::date, ${q.from}::date), 'YYYY-MM-DD') as "from",
           to_char(least(g.monday::date + 6, ${q.to}::date), 'YYYY-MM-DD') as "to",
           coalesce(s.seconds, 0)::int as seconds
    from generate_series(
      date_trunc('week', ${q.from}::date::timestamp),
      ${q.to}::date::timestamp,
      interval '1 week'
    ) as g(monday)
    left join (
      select date_trunc('week', l.local_date::timestamp) as monday,
             sum(l.duration_seconds) as seconds
      from (${taggedLogs(userId, q)}) as l
      group by 1
    ) as s on s.monday = g.monday
    order by g.monday
  `);
  return { tagId: q.tagId, from: q.from, to: q.to, weeks: result.rows };
}

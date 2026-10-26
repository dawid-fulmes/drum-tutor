import { randomUUID } from "node:crypto";
import type { Database } from "./client";
import { recomputeLessonRating } from "./ratings";
import {
  type LessonSignatureJson,
  lessonRatings,
  lessons,
  lessonTags,
  practiceLogs,
  tags,
  users,
} from "./schema";

type Difficulty = "beginner" | "intermediate" | "advanced";

const TAG_NAMES = [
  "Hand speed",
  "Weak hand",
  "Kick drum foot",
  "Hi-hat foot",
  "Rudiments",
  "Groove",
] as const;
type TagName = (typeof TAG_NAMES)[number];

type SeedLesson = {
  name: string;
  description: string;
  difficulty: Difficulty;
  tempo: number;
  minutes: number;
  status: "draft" | "published";
  tags: TagName[];
  signature: string;
};

// Ordered oldest to newest; created_at is derived from the index so every value is distinct.
// `signature` uses the spec §5.1 grid notation, parsed by `signatureFromGrid`.
const LESSONS: SeedLesson[] = [
  {
    name: "Single strokes on a pad",
    description:
      "Alternate right and left hand evenly on the snare or a practice pad. Keep the sticks low and the rebound relaxed. Start slow and only speed up when both hands sound the same.",
    difficulty: "beginner",
    tempo: 60,
    minutes: 3,
    status: "published",
    tags: ["Hand speed", "Weak hand"],
    signature: "S(R) S(L) S(R) S(L) S(R) S(L) S(R) S(L)",
  },
  {
    name: "Money beat",
    description:
      "Eighth notes on the closed hi-hat, kick on 1 and 3, snare on 2 and 4. Keep the hi-hat even and let the snare sit on top. Play it until it feels automatic.",
    difficulty: "beginner",
    tempo: 80,
    minutes: 5,
    status: "published",
    tags: ["Groove"],
    signature: "HK H HS H HK H HS H",
  },
  {
    name: "Single paradiddles",
    description:
      "Play the sticking R L R R L R L L on the snare. The double strokes should sound as even as the singles. Practice slowly at first; the pattern switches lead hand every half bar.",
    difficulty: "intermediate",
    tempo: 90,
    minutes: 4,
    status: "published",
    tags: ["Rudiments", "Hand speed"],
    signature: "S(R) S(L) S(R) S(R) S(L) S(R) S(L) S(L)",
  },
  {
    name: "Quarter-note kick control",
    description:
      "Play steady quarter notes on the kick drum with the heel up. Aim for the same volume on every hit and count the eighth-note rests out loud.",
    difficulty: "beginner",
    tempo: 70,
    minutes: 3,
    status: "published",
    tags: ["Kick drum foot"],
    signature: "K - K - K - K -",
  },
  {
    name: "Four on the floor",
    description:
      "Kick on every quarter note, eighth notes on the closed hi-hat, snare on 2 and 4. This is the backbone of disco and dance music. Keep the kick steady and do not rush the backbeat.",
    difficulty: "beginner",
    tempo: 100,
    minutes: 4,
    status: "published",
    tags: ["Groove", "Kick drum foot"],
    signature: "HK H HKS H HK H HKS H",
  },
  {
    name: "Weak hand eighth notes",
    description:
      "Play eighth notes on the snare with your weaker hand only. Watch the stick height and keep every stroke at the same volume. Rest when the forearm gets tense.",
    difficulty: "intermediate",
    tempo: 75,
    minutes: 5,
    status: "published",
    tags: ["Weak hand"],
    signature: "S(L) S(L) S(L) S(L) S(L) S(L) S(L) S(L)",
  },
  {
    name: "Double strokes",
    description:
      "Play R R L L on the snare. Let the second stroke of each double come from the rebound, not from the arm. Both notes of a double should be equally loud.",
    difficulty: "intermediate",
    tempo: 100,
    minutes: 6,
    status: "published",
    tags: ["Rudiments", "Hand speed", "Weak hand"],
    signature: "S(R) S(R) S(L) S(L) S(R) S(R) S(L) S(L)",
  },
  {
    name: "Inverted paradiddles",
    description:
      "Play the sticking R L L R L R R L on the snare. The doubles sit in the middle of each group, which makes it harder than the single paradiddle. Keep the tempo low until it flows.",
    difficulty: "intermediate",
    tempo: 85,
    minutes: 4,
    status: "published",
    tags: ["Rudiments", "Weak hand"],
    signature: "S(R) S(L) S(L) S(R) S(L) S(R) S(R) S(L)",
  },
  {
    name: "Disco offbeat hi-hat",
    description:
      "Kick on every quarter note, snare on 2 and 4, and the closed hi-hat only on the 'and' of each beat. The hi-hat between the kicks gives the groove its lift. Keep the hi-hat crisp and short.",
    difficulty: "intermediate",
    tempo: 110,
    minutes: 5,
    status: "published",
    tags: ["Groove", "Kick drum foot"],
    signature: "K H KS H K H KS H",
  },
  {
    name: "Rock beat with kick on 3&",
    description:
      "The money beat with an extra kick on the 'and' of 3. Play the two kicks on 3 and 3& with the same weight. Keep the hi-hat steady through the extra kick.",
    difficulty: "beginner",
    tempo: 85,
    minutes: 5,
    status: "published",
    tags: ["Groove", "Kick drum foot"],
    signature: "HK H HS H HK HK HS H",
  },
  {
    name: "Half-time groove",
    description:
      "Eighth notes on the hi-hat, kick on 1, snare only on 3, and a pickup kick on the 'and' of 4. The bar feels twice as long as the tempo. Let the snare ring.",
    difficulty: "intermediate",
    tempo: 70,
    minutes: 5,
    status: "published",
    tags: ["Groove"],
    signature: "HK H H H HS H H HK",
  },
  {
    name: "Linear eighths",
    description:
      "A linear pattern: no two limbs ever play together. Kick, right hand on the hi-hat and left hand on the snare take turns. Aim for even eighth notes across all three voices.",
    difficulty: "advanced",
    tempo: 95,
    minutes: 6,
    status: "published",
    tags: ["Groove", "Weak hand", "Kick drum foot"],
    signature: "K H(R) S(L) H(R) K K S(L) H(R)",
  },
  {
    name: "Offbeat snare reading",
    description:
      "Play the snare with the left hand only on the 'and' of each beat and count the downbeats out loud. The rests are as important as the notes. Lock in with the click on every quarter note.",
    difficulty: "beginner",
    tempo: 70,
    minutes: 3,
    status: "published",
    tags: ["Weak hand"],
    signature: "- S(L) - S(L) - S(L) - S(L)",
  },
  {
    name: "Syncopated kick groove",
    description:
      "Eighth notes on the hi-hat, snare on 2 and 4, kicks on 1, the 'and' of 2 and the 'and' of 3. The kicks between the beats push the groove forward. Keep the snare backbeat solid.",
    difficulty: "advanced",
    tempo: 90,
    minutes: 6,
    status: "published",
    tags: ["Groove", "Kick drum foot"],
    signature: "HK H HS HK H HK HS H",
  },
  {
    name: "Hand and foot alternation",
    description:
      "Kick on every beat and the snare on every 'and', alternating hands. Hands and foot never play together. Keep the spacing between foot and hand exactly even.",
    difficulty: "beginner",
    tempo: 80,
    minutes: 3,
    status: "published",
    tags: ["Kick drum foot", "Hand speed"],
    signature: "K S(R) K S(L) K S(R) K S(L)",
  },
  {
    name: "Paradiddle groove",
    description:
      "A paradiddle split between hands: the right hand plays the hi-hat, the left hand the snare, with kicks on 1 and 3. It sounds like a groove but trains the rudiment. Learn the hands alone before adding the kick.",
    difficulty: "advanced",
    tempo: 80,
    minutes: 5,
    status: "draft",
    tags: ["Rudiments", "Groove"],
    signature: "HK(R) S(L) H(R) H(R) SK(L) H(R) S(L) S(L)",
  },
  {
    name: "Kick and snare call",
    description:
      "Two short phrases between kick and snare with rests in between. Answer each kick phrase with the snare. Keep the rests exactly in time.",
    difficulty: "beginner",
    tempo: 75,
    minutes: 3,
    status: "draft",
    tags: ["Kick drum foot"],
    signature: "K - S - K K S -",
  },
  {
    name: "Hi-hat foot chicks on 2&4",
    description:
      "Close the hi-hat with your foot on 2 and 4 while counting quarter notes. The hi-hat foot cannot be written in the current notation yet, so this lesson stays a draft without a signature.",
    difficulty: "beginner",
    tempo: 65,
    minutes: 3,
    status: "draft",
    tags: ["Hi-hat foot", "Groove"],
    signature: "- - - - - - - -",
  },
];

const SIGNATURE_CODES = { H: "hihat-closed", S: "snare", K: "kick" } as const;

/**
 * Parses the spec §5.1 grid notation: 8 tokens, each `-` (rest) or a run of H/S/K, optionally
 * followed by `(comment)`. Anything else throws, so a typo fails `db:seed` instead of being stored.
 */
function signatureFromGrid(grid: string): LessonSignatureJson {
  const tokens = grid.trim().split(/\s+/);
  if (tokens.length !== 8) throw new Error(`Signature grid needs 8 slots: "${grid}"`);
  const slots = tokens.map((token) => {
    const match = /^(-|[HSK]+)(?:\(([^()]{1,3})\))?$/.exec(token);
    if (!match) throw new Error(`Invalid signature slot "${token}" in "${grid}"`);
    const [, notes = "", comment = ""] = match;
    const codes = notes === "-" ? [] : [...notes];
    if (new Set(codes).size !== codes.length) throw new Error(`Repeated instrument in "${token}"`);
    return {
      instruments: codes.map((code) => SIGNATURE_CODES[code as keyof typeof SIGNATURE_CODES]),
      comment,
    };
  });
  return { version: "v1", slots };
}

// The seed user's practised lessons (locked by those logs): Money beat, Single paradiddles and Weak
// hand eighth notes. Together they cover four tags: Groove, Rudiments, Hand speed and Weak hand.
// The other rated lessons are locked by their raters' own practice logs.
const LOGGED_LESSON_INDEXES = [1, 2, 5] as const;

// Ratings by lesson index (signature spec §5.1 numbering; rating spec §5.3). `seedUser` is the
// seed user's rating, `raters[k]` the rating of rater{k+1}@example.com.
const RATINGS: Record<number, { seedUser?: number; raters: readonly number[] }> = {
  4: { raters: [5, 5, 4, 5, 4, 5] },
  1: { seedUser: 5, raters: [4, 5, 5, 4] },
  0: { raters: [4, 5, 4, 5, 4, 5] },
  6: { raters: [5, 4] },
  2: { seedUser: 4, raters: [4, 3, 5] },
  8: { raters: [4] },
  5: { raters: [3, 4, 3] },
  3: { raters: [2, 3] },
};
const RATER_COUNT = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

// Practice days per week (0 = first day of the week counted from the start of the history), rotated
// weekly so every week has 3–5 practice days and some rest days.
const WEEK_PATTERNS = [
  [0, 2, 4],
  [1, 3, 5, 6],
  [0, 1, 3, 5],
  [0, 2, 3, 4, 6],
] as const;

type SeedLog = { lesson: SeedLesson; date: Date; minutes: number; tempo: number; hour: number };

/**
 * A deterministic practice history from 13 months ago up to yesterday (spec §4 "Seed"): 3–5 practice
 * days a week, a 4-day break every 6 weeks, 1–2 sessions a practice day, 5–30 minutes each.
 */
function practiceHistory(now: number): SeedLog[] {
  const today = new Date(now);
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - DAY_MS;
  const startDate = new Date(end);
  startDate.setUTCMonth(startDate.getUTCMonth() - 13);
  const logged = LOGGED_LESSON_INDEXES.map((i) => LESSONS[i] as SeedLesson);

  const logs: SeedLog[] = [];
  for (let day = 0, t = startDate.getTime(); t <= end; day++, t += DAY_MS) {
    const week = Math.floor(day / 7);
    const weekday = day % 7;
    if (week % 6 === 5 && weekday < 4) continue;
    const pattern: readonly number[] = WEEK_PATTERNS[week % WEEK_PATTERNS.length] ?? [];
    if (!pattern.includes(weekday)) continue;

    const sessions = day % 3 === 0 ? 2 : 1;
    for (let session = 0; session < sessions; session++) {
      // Rotate lessons per session, so every practised tag shows up every week.
      const lesson = logged[logs.length % logged.length] as SeedLesson;
      logs.push({
        lesson,
        date: new Date(t),
        minutes: 5 + ((day * 11 + session * 7) % 26),
        tempo: Math.min(300, Math.max(30, lesson.tempo + ((day % 5) - 2) * 2)),
        hour: 18 + session,
      });
    }
  }
  return logs;
}

/** Replaces all lesson data with the demo dataset (spec §4, "Seed"). Users are kept. */
export async function seedDatabase(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(lessonRatings);
    await tx.delete(practiceLogs);
    await tx.delete(lessonTags);
    await tx.delete(lessons);
    await tx.delete(tags);

    const now = Date.now();
    const tagRows = await tx
      .insert(tags)
      .values(TAG_NAMES.map((name) => ({ name })))
      .returning();
    const tagId = new Map(tagRows.map((t) => [t.name, t.id]));

    // Spread over the last ~30 days; each lesson is a fixed step apart, so every timestamp is distinct.
    // Practised lessons are ~14 months old instead, so no log predates its lesson.
    const step = (30 * DAY_MS) / LESSONS.length;
    const loggedIndexes: readonly number[] = LOGGED_LESSON_INDEXES;
    const lessonRows = await tx
      .insert(lessons)
      .values(
        LESSONS.map((l, i) => ({
          name: l.name,
          description: l.description,
          difficulty: l.difficulty,
          recommendedTempoBpm: l.tempo,
          recommendedDurationSeconds: l.minutes * 60,
          status: l.status,
          signature: signatureFromGrid(l.signature),
          createdAt: new Date(
            loggedIndexes.includes(i)
              ? now - 425 * DAY_MS + i * DAY_MS
              : now - 30 * DAY_MS + i * step,
          ),
        })),
      )
      .returning();
    const idByName = new Map(lessonRows.map((l) => [l.name, l.id]));

    await tx.insert(lessonTags).values(
      LESSONS.flatMap((l) =>
        l.tags.map((name) => ({
          lessonId: idByName.get(l.name) as string,
          tagId: tagId.get(name) as string,
        })),
      ),
    );

    const [seedUser] = await tx
      .insert(users)
      .values({ email: "seed@example.com" })
      .onConflictDoUpdate({ target: users.email, set: { email: "seed@example.com" } })
      .returning();
    const userId = (seedUser as { id: string }).id;
    const rows = practiceHistory(now).map((log) => ({
      userId,
      lessonId: idByName.get(log.lesson.name) as string,
      durationSeconds: log.minutes * 60,
      tempoBpm: log.tempo,
      completedAt: new Date(log.date.getTime() + log.hour * 60 * 60 * 1000),
      localDate: log.date.toISOString().slice(0, 10),
      idempotencyKey: randomUUID(),
    }));
    for (let i = 0; i < rows.length; i += 500) {
      await tx.insert(practiceLogs).values(rows.slice(i, i + 500));
    }

    // Raters: one log per rated lesson (yesterday 17:00 UTC) before the rating, so R3 holds.
    const raterIds: string[] = [];
    for (let k = 1; k <= RATER_COUNT; k++) {
      const email = `rater${k}@example.com`;
      const [rater] = await tx
        .insert(users)
        .values({ email })
        .onConflictDoUpdate({ target: users.email, set: { email } })
        .returning();
      raterIds.push((rater as { id: string }).id);
    }
    const yesterday = new Date(now - DAY_MS);
    const localDate = yesterday.toISOString().slice(0, 10);
    const completedAt = new Date(`${localDate}T17:00:00.000Z`);
    const ratingRows: { lessonId: string; userId: string; rating: number }[] = [];
    const raterLogs: (typeof practiceLogs.$inferInsert)[] = [];
    for (const [index, entry] of Object.entries(RATINGS)) {
      const lesson = LESSONS[Number(index)] as SeedLesson;
      const lessonId = idByName.get(lesson.name) as string;
      if (entry.seedUser !== undefined) {
        ratingRows.push({ lessonId, userId, rating: entry.seedUser });
      }
      entry.raters.forEach((rating, k) => {
        const raterId = raterIds[k] as string;
        raterLogs.push({
          userId: raterId,
          lessonId,
          durationSeconds: 180,
          tempoBpm: lesson.tempo,
          completedAt,
          localDate,
          idempotencyKey: randomUUID(),
        });
        ratingRows.push({ lessonId, userId: raterId, rating });
      });
    }
    await tx.insert(practiceLogs).values(raterLogs);
    await tx.insert(lessonRatings).values(ratingRows);
    for (const lessonId of new Set(ratingRows.map((r) => r.lessonId))) {
      await recomputeLessonRating(tx, lessonId);
    }
  });
}

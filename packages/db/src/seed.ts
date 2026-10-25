import type { Database } from "./client";
import { lessons, lessonTags, practiceLogs, tags, users } from "./schema";

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
};

// Ordered oldest to newest; created_at is derived from the index so every value is distinct.
const LESSONS: SeedLesson[] = [
  {
    name: "Single strokes on a pad",
    description:
      "Alternate right and left hand evenly on a practice pad. Keep the sticks low and the rebound relaxed.",
    difficulty: "beginner",
    tempo: 60,
    minutes: 3,
    status: "published",
    tags: ["Hand speed"],
  },
  {
    name: "Money beat",
    description:
      "Eighth notes on the hi-hat, kick on 1 and 3, snare on 2 and 4. Play it until it feels automatic.",
    difficulty: "beginner",
    tempo: 80,
    minutes: 5,
    status: "published",
    tags: ["Groove"],
  },
  {
    name: "Paradiddle accents",
    description:
      "Play a single paradiddle and accent the first note of each group. Keep the unaccented notes quiet.",
    difficulty: "intermediate",
    tempo: 90,
    minutes: 4,
    status: "published",
    tags: ["Rudiments", "Hand speed"],
  },
  {
    name: "Quarter-note kick control",
    description:
      "Play steady quarter notes on the kick drum with the heel up. Aim for the same volume on every hit.",
    difficulty: "beginner",
    tempo: 70,
    minutes: 3,
    status: "published",
    tags: ["Kick drum foot"],
  },
  {
    name: "Hi-hat foot chicks on 2 and 4",
    description:
      "Close the hi-hat with your foot on beats 2 and 4 while your hands rest, then add a ride pattern on top.",
    difficulty: "beginner",
    tempo: 65,
    minutes: 3,
    status: "published",
    tags: ["Hi-hat foot", "Groove"],
  },
  {
    name: "Weak hand eighth notes",
    description:
      "Lead every eighth-note group with your weak hand on the snare. Keep the stroke height equal for both hands.",
    difficulty: "intermediate",
    tempo: 75,
    minutes: 5,
    status: "published",
    tags: ["Weak hand"],
  },
  {
    name: "Double stroke roll ladder",
    description:
      "Build a double stroke roll from slow to fast in four steps, holding each tempo for one bar.",
    difficulty: "intermediate",
    tempo: 100,
    minutes: 6,
    status: "published",
    tags: ["Rudiments", "Hand speed", "Weak hand"],
  },
  {
    name: "Sixteenth-note hi-hat groove",
    description:
      "Play steady sixteenth notes on the hi-hat with the snare on 2 and 4 and a simple kick pattern.",
    difficulty: "intermediate",
    tempo: 85,
    minutes: 5,
    status: "published",
    tags: ["Groove", "Hi-hat foot"],
  },
  {
    name: "Heel-toe kick doubles",
    description:
      "Play two kick notes in a row using the heel-toe motion. Start slowly and keep both notes even.",
    difficulty: "advanced",
    tempo: 110,
    minutes: 5,
    status: "published",
    tags: ["Kick drum foot"],
  },
  {
    name: "Flam taps",
    description:
      "Play flam taps between the hands with a clear, quiet grace note before each flam.",
    difficulty: "intermediate",
    tempo: 80,
    minutes: 4,
    status: "published",
    tags: ["Rudiments"],
  },
  {
    name: "Linear funk pattern",
    description:
      "No two limbs play at the same time. Count sixteenth notes out loud and keep the ghost notes soft.",
    difficulty: "advanced",
    tempo: 95,
    minutes: 8,
    status: "published",
    tags: ["Groove", "Weak hand", "Kick drum foot"],
  },
  {
    name: "Triplet fill around the toms",
    description:
      "Play an eighth-note triplet fill from the snare down to the floor tom and land on the crash.",
    difficulty: "intermediate",
    tempo: 90,
    minutes: 4,
    status: "published",
    tags: ["Hand speed", "Groove"],
  },
  {
    name: "Five stroke roll endurance",
    description:
      "Repeat the five stroke roll for the whole duration without losing evenness between the strokes.",
    difficulty: "advanced",
    tempo: 120,
    minutes: 10,
    status: "published",
    tags: ["Rudiments", "Hand speed"],
  },
  {
    name: "Hi-hat foot splashes",
    description:
      "Splash the hi-hat with your foot on the offbeats while your hands keep a steady quarter-note pulse.",
    difficulty: "advanced",
    tempo: 100,
    minutes: 5,
    status: "published",
    tags: ["Hi-hat foot"],
  },
  {
    name: "Swiss army triplets",
    description:
      "Combine flams and a triplet rudiment pattern around the snare. Keep the accents sharp and the rest soft.",
    difficulty: "advanced",
    tempo: 105,
    minutes: 6,
    status: "published",
    tags: ["Rudiments", "Weak hand"],
  },
  {
    name: "Half-time shuffle",
    description: "A half-time shuffle with ghost notes on the snare, played at a relaxed tempo.",
    difficulty: "advanced",
    tempo: 70,
    minutes: 8,
    status: "draft",
    tags: ["Groove"],
  },
  {
    name: "Left foot clave on hi-hat",
    description: "Play a 3-2 clave with the hi-hat foot while the hands keep a basic rock beat.",
    difficulty: "advanced",
    tempo: 80,
    minutes: 6,
    status: "draft",
    tags: ["Hi-hat foot", "Groove"],
  },
  {
    name: "Alternating single strokes warm-up",
    description:
      "A short warm-up of single strokes at three tempos to start every practice session.",
    difficulty: "beginner",
    tempo: 60,
    minutes: 2,
    status: "draft",
    tags: ["Hand speed", "Weak hand"],
  },
];

// Index of the published lesson that gets the practice log (and so is locked).
const LOGGED_LESSON_INDEX = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Replaces all lesson data with the demo dataset (spec §4, "Seed"). Users are kept. */
export async function seedDatabase(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
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
    const step = (30 * DAY_MS) / LESSONS.length;
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
          createdAt: new Date(now - 30 * DAY_MS + i * step),
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
    const logged = LESSONS[LOGGED_LESSON_INDEX] as SeedLesson;
    const completedAt = new Date(now - DAY_MS);
    await tx.insert(practiceLogs).values({
      userId: (seedUser as { id: string }).id,
      lessonId: idByName.get(logged.name) as string,
      durationSeconds: logged.minutes * 60,
      tempoBpm: logged.tempo,
      completedAt,
      localDate: completedAt.toISOString().slice(0, 10),
    });
  });
}

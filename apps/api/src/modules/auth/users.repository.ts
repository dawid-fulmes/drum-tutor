import type { User } from "@drum-tutor/contracts";
import { type Database, type UserRow, users } from "@drum-tutor/db";
import { eq } from "drizzle-orm";

/** Race-safe: concurrent calls for the same new email create one row (unique email + on conflict). */
export async function findOrCreateUserByEmail(db: Database, email: string): Promise<UserRow> {
  await db.insert(users).values({ email }).onConflictDoNothing({ target: users.email });
  const [row] = await db.select().from(users).where(eq(users.email, email));
  if (!row) {
    throw new Error("User row missing right after upsert");
  }
  return row;
}

export async function findUserById(db: Database, id: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row ?? null;
}

export function toUserDto(row: UserRow): User {
  return { id: row.id, email: row.email, createdAt: row.createdAt.toISOString() };
}

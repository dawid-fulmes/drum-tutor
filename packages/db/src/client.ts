import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

export function createDb(
  connectionString: string,
  options: { onPoolError?: (error: Error) => void } = {},
): { db: Database; close: () => Promise<void> } {
  const pool = new Pool({ connectionString });
  // Without a listener, an idle connection dropped by the server (db:reset, Docker restart, sleep)
  // is an unhandled 'error' event that kills the process. The pool replaces the connection itself.
  pool.on("error", (error) => {
    if (options.onPoolError) {
      options.onPoolError(error);
    } else {
      console.warn(`PostgreSQL connection lost (the pool reconnects): ${error.message}`);
    }
  });
  return {
    db: drizzle(pool, { schema }),
    close: () => pool.end(),
  };
}

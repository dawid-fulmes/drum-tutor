import type { Database } from "@drum-tutor/db";

/** The handle `db.transaction` passes to its callback. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** The pool-backed database or an open transaction, for queries used both inside and outside one. */
export type DbExecutor = Database | Transaction;

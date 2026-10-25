-- Existing rows (seed, tests) get a generated key; new rows must supply one (ADR-0042).
ALTER TABLE "practice_logs" ADD COLUMN "idempotency_key" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_logs" ALTER COLUMN "idempotency_key" DROP DEFAULT;--> statement-breakpoint
CREATE UNIQUE INDEX "practice_logs_user_idempotency_key_idx" ON "practice_logs" USING btree ("user_id","idempotency_key");--> statement-breakpoint
-- INCLUDE is hand-written: Drizzle 0.45 cannot express it (ADR-0048).
CREATE INDEX "practice_logs_user_local_date_idx" ON "practice_logs" USING btree ("user_id","local_date") INCLUDE ("lesson_id","duration_seconds");

CREATE TYPE "public"."lesson_difficulty" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."lesson_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "lesson_tags" (
	"lesson_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "lesson_tags_lesson_id_tag_id_pk" PRIMARY KEY("lesson_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"difficulty" "lesson_difficulty" NOT NULL,
	"recommended_tempo_bpm" integer NOT NULL,
	"recommended_duration_seconds" integer NOT NULL,
	"status" "lesson_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessons_tempo_range" CHECK ("lessons"."recommended_tempo_bpm" between 30 and 300),
	CONSTRAINT "lessons_duration_range" CHECK ("lessons"."recommended_duration_seconds" between 30 and 3600 and "lessons"."recommended_duration_seconds" % 30 = 0)
);
--> statement-breakpoint
CREATE TABLE "practice_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"duration_seconds" integer NOT NULL,
	"tempo_bpm" integer NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	CONSTRAINT "practice_logs_duration_range" CHECK ("practice_logs"."duration_seconds" between 30 and 3600 and "practice_logs"."duration_seconds" % 30 = 0),
	CONSTRAINT "practice_logs_tempo_range" CHECK ("practice_logs"."tempo_bpm" between 30 and 300)
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_tags" ADD CONSTRAINT "lesson_tags_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_tags" ADD CONSTRAINT "lesson_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_logs" ADD CONSTRAINT "practice_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_logs" ADD CONSTRAINT "practice_logs_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_tags_tag_id_idx" ON "lesson_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "lessons_status_created_at_id_idx" ON "lessons" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "practice_logs_lesson_id_idx" ON "practice_logs" USING btree ("lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_lower_unique" ON "tags" USING btree (lower("name"));
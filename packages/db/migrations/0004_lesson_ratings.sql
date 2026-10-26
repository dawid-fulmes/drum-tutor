-- Ratings and the stored aggregate on lessons (ADR-0055, spec §5).
CREATE TABLE "lesson_ratings" (
	"lesson_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_ratings_lesson_id_user_id_pk" PRIMARY KEY("lesson_id","user_id"),
	CONSTRAINT "lesson_ratings_rating_range" CHECK ("lesson_ratings"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "rating_avg" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "lesson_ratings" ADD CONSTRAINT "lesson_ratings_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_ratings" ADD CONSTRAINT "lesson_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lessons_status_rating_idx" ON "lessons" USING btree ("status","rating_avg" DESC NULLS LAST,"rating_count" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_rating_avg_matches_count" CHECK (("lessons"."rating_count" = 0) = ("lessons"."rating_avg" is null));--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_rating_avg_range" CHECK ("lessons"."rating_avg" between 1 and 5);
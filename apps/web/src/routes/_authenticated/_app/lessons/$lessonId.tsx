import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LessonDetails, LessonNotFound } from "@/features/lessons/lesson-details";

export const Route = createFileRoute("/_authenticated/_app/lessons/$lessonId")({
  component: LessonDetailsPage,
});

function LessonDetailsPage() {
  const { lessonId } = Route.useParams();
  // The API answers 400 for a malformed id; skip the request and show "not found" right away.
  if (!z.uuid().safeParse(lessonId).success) return <LessonNotFound />;
  // A new key per lesson mounts a fresh practice panel (and stops the previous metronome).
  return <LessonDetails key={lessonId} id={lessonId} />;
}

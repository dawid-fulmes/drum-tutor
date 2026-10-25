import type { Difficulty } from "@drum-tutor/contracts";

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function formatDifficulty(difficulty: Difficulty): string {
  return DIFFICULTY_LABELS[difficulty];
}

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

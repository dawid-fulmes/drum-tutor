import type { Difficulty } from "@drum-tutor/contracts";

export function formatDifficulty(difficulty: Difficulty): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

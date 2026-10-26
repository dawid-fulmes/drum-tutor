import type { RatingSummary } from "@drum-tutor/contracts";

/**
 * Formats a lesson's rating summary for display.
 *
 * The average is rounded half up to one decimal. It goes through integer
 * hundredths first, because `4.35 * 10` is `43.4999…` in floating point.
 */
export function formatRating(
  summary: RatingSummary,
  variant: "card" | "page",
): { text: string; label: string } {
  if (summary.average === null || summary.count === 0) {
    return { text: "No ratings yet", label: "No ratings yet" };
  }

  const average = (Math.round(Math.round(summary.average * 100) / 10) / 10).toFixed(1);
  const { count } = summary;
  const label = `Rated ${average} out of 5 from ${count} ${count === 1 ? "rating" : "ratings"}`;

  if (variant === "card") {
    return { text: `★ ${average} (${count})`, label };
  }
  return {
    text: `★ ${average} · ${count} ${count === 1 ? "rating" : "ratings"}`,
    label,
  };
}

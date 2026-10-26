import type { LessonDetail } from "@drum-tutor/contracts";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatRating } from "./format-rating";
import { RatingDialog } from "./rating-dialog";

/**
 * The lesson's rating summary and the drummer's rating action (spec §7.3). Whether the drummer
 * may rate comes only from `canRate`, the current rating only from `myRating` (ADR-0059).
 */
export function LessonRatingRow({ lesson }: { lesson: LessonDetail }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const summary = formatRating(lesson.rating, "page");
  const { canRate, myRating } = lesson;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-sm">
        <span aria-hidden>{summary.text}</span>
        <span className="sr-only">{summary.label}</span>
      </p>
      {canRate && myRating !== null ? (
        <Button
          ref={buttonRef}
          variant="outline"
          onClick={() => setOpen(true)}
          aria-label={`Change your rating, currently ${myRating} out of 5`}
        >
          Your rating: {myRating} ★
        </Button>
      ) : (
        <Button ref={buttonRef} variant="outline" onClick={() => setOpen(true)} disabled={!canRate}>
          Rate this lesson
        </Button>
      )}
      {!canRate && (
        <p className="text-sm text-muted-foreground">Complete this lesson once to rate it.</p>
      )}
      {/* Always mounted: after a stale-page 409 the refetch flips `canRate` off, and the open
          modal must stay up with the toast instead of vanishing (spec §7.4). */}
      <RatingDialog lesson={lesson} open={open} onOpenChange={setOpen} returnFocusRef={buttonRef} />
    </div>
  );
}

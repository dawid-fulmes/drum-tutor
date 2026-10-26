import type { LessonDetail } from "@drum-tutor/contracts";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRateLesson } from "./rating.api";
import { StarRatingInput } from "./star-rating-input";

type RatingDialogProps = {
  lesson: LessonDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opened the dialog; it has no `DialogTrigger`, so Radix cannot find it. */
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function RatingDialog({ lesson, open, onOpenChange, returnFocusRef }: RatingDialogProps) {
  const [selected, setSelected] = useState<number | null>(lesson.myRating);
  const contentRef = useRef<HTMLDivElement>(null);
  const rate = useRateLesson(lesson.id);

  // An abandoned choice must not survive a close: every open starts from the stored rating.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the dialog opens
  useEffect(() => {
    if (open) setSelected(lesson.myRating);
  }, [open]);

  const save = () => {
    if (selected === null) return;
    rate.mutate(selected, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        // Radix focuses the first radio; arrow keys must start from the stored rating instead.
        // Looked up by value, not `:checked`: this runs before the reset effect above.
        onOpenAutoFocus={(event) => {
          if (lesson.myRating === null) return;
          const stored = contentRef.current?.querySelector<HTMLInputElement>(
            `input[type="radio"][value="${lesson.myRating}"]`,
          );
          if (!stored) return;
          event.preventDefault();
          stored.focus();
        }}
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef?.current) return;
          event.preventDefault();
          returnFocusRef.current.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Rate {lesson.name}</DialogTitle>
        </DialogHeader>
        <StarRatingInput value={selected} onChange={setSelected} disabled={rate.isPending} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={selected === null || rate.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

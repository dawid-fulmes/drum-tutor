import { Star } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

type StarRatingInputProps = {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
};

/**
 * Native radios in a radiogroup: arrow keys move the selection, Enter or Space selects, and the focused
 * star shows the focus ring. The radios are visually hidden; the labels draw the stars.
 */
export function StarRatingInput({ value, onChange, disabled }: StarRatingInputProps) {
  const name = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const highlighted = hovered ?? value ?? 0;

  return (
    <div
      role="radiogroup"
      aria-label="Rating"
      className="flex gap-1"
      onMouseLeave={() => setHovered(null)}
    >
      {STARS.map((star) => (
        <label
          key={star}
          onMouseEnter={() => !disabled && setHovered(star)}
          className={cn(
            "rounded-sm p-1 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          )}
        >
          <input
            type="radio"
            name={name}
            value={star}
            checked={value === star}
            disabled={disabled}
            onChange={() => onChange(star)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              onChange(star);
            }}
            className="sr-only"
            aria-label={star === 1 ? "1 star" : `${star} stars`}
          />
          <Star
            aria-hidden="true"
            className={cn(
              "size-8",
              star <= highlighted ? "fill-primary text-primary" : "text-muted-foreground",
            )}
          />
        </label>
      ))}
    </div>
  );
}

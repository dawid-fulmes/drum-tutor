import type { Tag } from "@drum-tutor/contracts";
import { X } from "lucide-react";
import { useState } from "react";
import { QueryError } from "@/components/query-error";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTagsByIds } from "./tags.api";

type SelectedTagsProps = {
  ids: string[];
  onRemove: (id: string) => void;
  disabled?: boolean;
};

export function SelectedTags({ ids, onRemove, disabled }: SelectedTagsProps) {
  const { data, isPending, isError, error, refetch } = useTagsByIds(ids);
  // While a new lookup is pending, keep showing the last resolved tags that are still selected
  // (the placeholder lives here, not in `useTagsByIds`, whose callers must never act on it).
  const [lastResolved, setLastResolved] = useState<Tag[]>([]);
  if (data && data !== lastResolved) setLastResolved(data);

  if (ids.length === 0) return null;
  if (isError) return <QueryError error={error} onRetry={() => refetch()} />;
  const tags = data ?? lastResolved.filter((tag) => ids.includes(tag.id));
  if (isPending && tags.length === 0) return <Skeleton className="h-5 w-32" />;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li key={tag.id}>
          <Badge variant="secondary" className="gap-1">
            {tag.name}
            <button
              type="button"
              aria-label={`Remove ${tag.name}`}
              disabled={disabled}
              onClick={() => onRemove(tag.id)}
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              <X className="size-3" aria-hidden />
            </button>
          </Badge>
        </li>
      ))}
    </ul>
  );
}

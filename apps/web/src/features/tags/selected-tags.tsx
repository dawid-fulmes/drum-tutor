import { X } from "lucide-react";
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
  const { data: tags, isPending, isError, error, refetch } = useTagsByIds(ids);

  if (ids.length === 0) return null;
  if (isPending) return <Skeleton className="h-5 w-32" />;
  if (isError) return <QueryError error={error} onRetry={() => refetch()} />;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags?.map((tag) => (
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

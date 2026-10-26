import type { Tag } from "@drum-tutor/contracts";
import { Check } from "lucide-react";
import { useState } from "react";
import { LoadMoreSentinel } from "@/components/load-more-sentinel";
import { QueryError } from "@/components/query-error";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { useTagSearch } from "./tags.api";

type TagSearchListProps = {
  /** Owned by the picker, so the search text survives closing the popover. */
  input: string;
  onInputChange: (input: string) => void;
  selectedIds: readonly string[];
  onSelect: (tag: Tag) => void;
  multiselect: boolean;
  /** False once a selection cap is reached: unselected tags get disabled. */
  canSelectMore?: boolean;
  /** Shown under the input when `canSelectMore` is false. */
  maxHint?: string;
};

/** Server-side tag search with infinite scroll (ADR-0033), shared by the tag pickers. */
export function TagSearchList({
  input,
  onInputChange,
  selectedIds,
  onSelect,
  multiselect,
  canSelectMore = true,
  maxHint,
}: TagSearchListProps) {
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const q = useDebouncedValue(input.trim(), 300);
  const search = useTagSearch(q);
  const tags = search.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder="Search tags"
        maxLength={50}
        value={input}
        onValueChange={onInputChange}
      />
      {!canSelectMore && maxHint && (
        <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
          {maxHint}
        </p>
      )}
      <CommandList ref={setList} aria-multiselectable={multiselect || undefined}>
        {search.isPending ? (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : search.isError ? (
          <div className="p-2">
            <QueryError error={search.error} onRetry={() => search.refetch()} />
          </div>
        ) : (
          <>
            {tags.length === 0 && <CommandEmpty>No tags found</CommandEmpty>}
            <CommandGroup>
              {tags.map((tag) => {
                const checked = selectedIds.includes(tag.id);
                return (
                  <CommandItem
                    key={tag.id}
                    value={tag.id}
                    aria-checked={multiselect ? checked : undefined}
                    aria-selected={multiselect ? undefined : checked}
                    disabled={!checked && !canSelectMore}
                    onSelect={() => onSelect(tag)}
                  >
                    {multiselect ? (
                      <Checkbox
                        checked={checked}
                        tabIndex={-1}
                        aria-hidden
                        className="pointer-events-none"
                      />
                    ) : (
                      <Check aria-hidden className={cn(!checked && "invisible")} />
                    )}
                    {tag.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <LoadMoreSentinel
              root={list}
              enabled={
                search.hasNextPage && !search.isFetchingNextPage && !search.isFetchNextPageError
              }
              onLoadMore={() => search.fetchNextPage()}
            />
          </>
        )}
      </CommandList>
    </Command>
  );
}

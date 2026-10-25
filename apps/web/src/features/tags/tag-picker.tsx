import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { LoadMoreSentinel } from "@/components/load-more-sentinel";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTagSearch } from "./tags.api";

type TagPickerProps = {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  invalid?: boolean;
};

export function TagPicker({ value, onChange, disabled, invalid }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const q = useDebouncedValue(input.trim(), 300);
  const search = useTagSearch(q);
  const tags = search.data?.pages.flatMap((page) => page.items) ?? [];

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((selected) => selected !== id) : [...value, id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className="justify-between"
        >
          {value.length > 0 ? `Tags (${value.length})` : "Tags"}
          <ChevronsUpDown aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search tags" value={input} onValueChange={setInput} />
          <CommandList ref={setList}>
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
                  {tags.map((tag) => (
                    <CommandItem key={tag.id} value={tag.id} onSelect={() => toggle(tag.id)}>
                      <Checkbox
                        checked={value.includes(tag.id)}
                        tabIndex={-1}
                        aria-hidden
                        className="pointer-events-none"
                      />
                      {tag.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <LoadMoreSentinel
                  root={list}
                  enabled={search.hasNextPage && !search.isFetchingNextPage}
                  onLoadMore={() => search.fetchNextPage()}
                />
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

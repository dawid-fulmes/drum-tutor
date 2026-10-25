import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TagSearchList } from "./tag-search-list";
import { useTagsByIds } from "./tags.api";

type TagSelectProps = {
  value: string | undefined;
  onChange: (id: string) => void;
};

/** Picks one tag from all tags; the name of the selected one comes from one `ids` lookup. */
export function TagSelect({ value, onChange }: TagSelectProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const selected = useTagsByIds(value ? [value] : []);
  const name = selected.data?.find((tag) => tag.id === value)?.name;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={name ? `Tag: ${name}` : "Select a tag"}
          className="min-w-44 justify-between"
        >
          {name ?? "Select a tag"}
          <ChevronsUpDown aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <TagSearchList
          input={input}
          onInputChange={setInput}
          selectedIds={value ? [value] : []}
          multiselect={false}
          onSelect={(tag) => {
            onChange(tag.id);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

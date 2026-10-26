import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TagSearchList } from "./tag-search-list";

type TagPickerProps = {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Selection cap; unselected tags are disabled once reached. No cap by default. */
  max?: number;
};

export function TagPicker({ value, onChange, disabled, invalid, max }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((selected) => selected !== id) : [...value, id]);
  };

  const canSelectMore = max === undefined || value.length < max;

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
        <TagSearchList
          input={input}
          onInputChange={setInput}
          selectedIds={value}
          onSelect={(tag) => toggle(tag.id)}
          multiselect
          canSelectMore={canSelectMore}
          maxHint={max === undefined ? undefined : `You can select up to ${max} tags`}
        />
      </PopoverContent>
    </Popover>
  );
}

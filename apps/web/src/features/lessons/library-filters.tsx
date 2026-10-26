import { DIFFICULTIES, type Difficulty, LessonSortSchema } from "@drum-tutor/contracts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TagPicker } from "@/features/tags/tag-picker";
import { formatDifficulty } from "./format";
import { hasActiveFilters, LIBRARY_MAX_TAGS, type LibrarySearch } from "./library-search";

type LibraryFiltersProps = {
  search: LibrarySearch;
  onChange: (patch: Partial<LibrarySearch>) => void;
  onClear: () => void;
};

export function LibraryFilters({ search, onChange, onClear }: LibraryFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <TagPicker
        value={search.tagIds}
        onChange={(tagIds) => onChange({ tagIds })}
        max={LIBRARY_MAX_TAGS}
      />
      <ToggleGroup
        type="multiple"
        variant="outline"
        aria-label="Difficulty"
        value={search.difficulties}
        onValueChange={(values) =>
          onChange({
            difficulties: DIFFICULTIES.filter((difficulty: Difficulty) =>
              values.includes(difficulty),
            ),
          })
        }
      >
        {DIFFICULTIES.map((difficulty) => (
          <ToggleGroupItem key={difficulty} value={difficulty}>
            {formatDifficulty(difficulty)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Select
        value={search.sort}
        onValueChange={(value) => {
          const sort = LessonSortSchema.safeParse(value);
          if (sort.success) onChange({ sort: sort.data });
        }}
      >
        <SelectTrigger aria-label="Sort">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="rating">Highest rated</SelectItem>
          <SelectItem value="newest">Newest first</SelectItem>
          <SelectItem value="oldest">Oldest first</SelectItem>
        </SelectContent>
      </Select>
      {hasActiveFilters(search) && (
        <Button variant="ghost" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

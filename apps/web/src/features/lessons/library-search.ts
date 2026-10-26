import { DifficultySchema, LessonSortSchema } from "@drum-tutor/contracts";
import { z } from "zod";

export const LIBRARY_PAGE_SIZES = [12, 24, 48] as const;

export const LIBRARY_MAX_TAGS = 20;

const unique = <T>(items: T[]): T[] => [...new Set(items)];

export const librarySearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z
    .literal([...LIBRARY_PAGE_SIZES])
    .default(12)
    .catch(12),
  tagIds: z.array(z.uuid()).max(LIBRARY_MAX_TAGS).transform(unique).default([]).catch([]),
  difficulties: z.array(DifficultySchema).transform(unique).default([]).catch([]),
  sort: LessonSortSchema.default("rating").catch("rating"),
});
export type LibrarySearch = z.infer<typeof librarySearchSchema>;

export function hasActiveFilters(search: LibrarySearch): boolean {
  return search.tagIds.length > 0 || search.difficulties.length > 0;
}

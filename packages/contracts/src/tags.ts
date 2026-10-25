import { z } from "zod";
import { PaginationQuerySchema, queryArray } from "./pagination";

/** Tag name (ADR-0036): trimmed, inner whitespace collapsed, 1-50 chars. */
export const TagNameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, " "))
  .pipe(z.string().min(1, "Tag name is required").max(50, "Tag name can be at most 50 characters"));

export const TagInputSchema = z.object({ name: TagNameSchema });
export type TagInput = z.input<typeof TagInputSchema>;

export const TagSchema = z.object({ id: z.uuid(), name: z.string() });
export type Tag = z.infer<typeof TagSchema>;

export const AdminTagSchema = TagSchema.extend({ lessonCount: z.number().int().min(0) });
export type AdminTag = z.infer<typeof AdminTagSchema>;

export const TagListQuerySchema = PaginationQuerySchema.extend({
  q: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(z.string().max(50))
    .optional(),
  ids: queryArray(z.uuid(), 100),
});
export type TagListQuery = z.output<typeof TagListQuerySchema>;

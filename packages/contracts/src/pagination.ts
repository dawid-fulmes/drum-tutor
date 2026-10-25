import { z } from "zod";

/** Page-based pagination query (ADR-0032). Values arrive as strings and are coerced. */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.output<typeof PaginationQuerySchema>;

export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int().min(0),
    pageSize: z.number().int().min(0),
    totalItems: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  });
export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

/**
 * Array query parameter: Fastify gives a string for a single key and an array for repeated keys.
 * The cap applies to the raw input (before deduplication); absent means `[]`.
 */
export const queryArray = <T extends z.ZodType>(item: T, max: number) =>
  z
    .union([item, z.array(item).max(max)])
    .transform((value): z.output<T>[] => {
      const values = Array.isArray(value) ? value : [value];
      return [...new Set<z.output<T>>(values)];
    })
    .default([]);

export const IdParamsSchema = z.object({ id: z.uuid() });

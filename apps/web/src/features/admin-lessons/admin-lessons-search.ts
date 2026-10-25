import { z } from "zod";

export const ADMIN_LESSONS_PAGE_SIZES = [20, 50, 100] as const;

export const adminLessonsSearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z
    .union([z.literal(20), z.literal(50), z.literal(100)])
    .default(20)
    .catch(20),
});
export type AdminLessonsSearch = z.infer<typeof adminLessonsSearchSchema>;

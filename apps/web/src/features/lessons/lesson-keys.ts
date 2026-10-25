import type { AdminLessonsSearch } from "../admin-lessons/admin-lessons-search";

/** `all` is the shared root: admin mutations invalidate library data too (plan 03 adds `library`). */
export const lessonKeys = {
  all: ["lessons"] as const,
  admin: {
    list: (search: AdminLessonsSearch) => [...lessonKeys.all, "admin", "list", search] as const,
    detail: (id: string) => [...lessonKeys.all, "admin", "detail", id] as const,
  },
};

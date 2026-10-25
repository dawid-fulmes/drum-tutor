import type { AdminLessonsSearch } from "../admin-lessons/admin-lessons-search";
import type { LibrarySearch } from "./library-search";

/** `all` is the shared root: admin mutations invalidate library data too. */
export const lessonKeys = {
  all: ["lessons"] as const,
  admin: {
    list: (search: AdminLessonsSearch) => [...lessonKeys.all, "admin", "list", search] as const,
    detail: (id: string) => [...lessonKeys.all, "admin", "detail", id] as const,
  },
  library: {
    list: (search: LibrarySearch) => [...lessonKeys.all, "library", "list", search] as const,
    detail: (id: string) => [...lessonKeys.all, "library", "detail", id] as const,
  },
};

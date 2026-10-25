import {
  ApiPaths,
  LessonDetailSchema,
  LessonSummarySchema,
  pageSchema,
  withId,
} from "@drum-tutor/contracts";
import { queryOptions } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { lessonKeys } from "./lesson-keys";
import type { LibrarySearch } from "./library-search";

export const LessonPageSchema = pageSchema(LessonSummarySchema);

export const libraryQueryOptions = (search: LibrarySearch) =>
  queryOptions({
    queryKey: lessonKeys.library.list(search),
    queryFn: () =>
      apiRequest(ApiPaths.lessons, {
        query: {
          page: search.page,
          pageSize: search.pageSize,
          tagIds: search.tagIds,
          difficulties: search.difficulties,
          sort: search.sort,
        },
        schema: LessonPageSchema,
      }),
  });

export const lessonQueryOptions = (id: string) =>
  queryOptions({
    queryKey: lessonKeys.library.detail(id),
    queryFn: () => apiRequest(withId(ApiPaths.lesson, id), { schema: LessonDetailSchema }),
  });

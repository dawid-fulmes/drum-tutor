import {
  AdminLessonSchema,
  AdminLessonSummarySchema,
  ApiPaths,
  type LessonInput,
  pageSchema,
  withId,
} from "@drum-tutor/contracts";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { lessonKeys } from "../lessons/lesson-keys";
import { tagKeys } from "../tags/tags.api";
import type { AdminLessonsSearch } from "./admin-lessons-search";

export const AdminLessonPageSchema = pageSchema(AdminLessonSummarySchema);

export const adminLessonsQueryOptions = (search: AdminLessonsSearch) =>
  queryOptions({
    queryKey: lessonKeys.admin.list(search),
    queryFn: () =>
      apiRequest(ApiPaths.adminLessons, {
        query: { page: search.page, pageSize: search.pageSize },
        schema: AdminLessonPageSchema,
      }),
  });

export const adminLessonQueryOptions = (id: string) =>
  queryOptions({
    queryKey: lessonKeys.admin.detail(id),
    queryFn: () => apiRequest(withId(ApiPaths.adminLesson, id), { schema: AdminLessonSchema }),
  });

function useInvalidatingMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  successMessage: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      toast.success(successMessage);
      // Tags embed `lessonCount`, which every lesson mutation can change.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: lessonKeys.all }),
        queryClient.invalidateQueries({ queryKey: tagKeys.all }),
      ]);
    },
  });
}

export function useCreateLesson() {
  return useInvalidatingMutation(
    (body: LessonInput) =>
      apiRequest(ApiPaths.adminLessons, { method: "POST", body, schema: AdminLessonSchema }),
    "Lesson created",
  );
}

export function useUpdateLesson(id: string) {
  return useInvalidatingMutation(
    (body: LessonInput) =>
      apiRequest(withId(ApiPaths.adminLesson, id), {
        method: "PUT",
        body,
        schema: AdminLessonSchema,
      }),
    "Lesson saved",
  );
}

export function useDeleteLesson() {
  return useInvalidatingMutation(
    (id: string) =>
      apiRequest(withId(ApiPaths.adminLesson, id), { method: "DELETE", schema: null }),
    "Lesson deleted",
  );
}

export function usePublishLesson() {
  return useInvalidatingMutation(
    (id: string) =>
      apiRequest(withId(ApiPaths.adminLessonPublish, id), {
        method: "POST",
        schema: AdminLessonSchema,
      }),
    "Lesson published",
  );
}

export function useUnpublishLesson() {
  return useInvalidatingMutation(
    (id: string) =>
      apiRequest(withId(ApiPaths.adminLessonUnpublish, id), {
        method: "POST",
        schema: AdminLessonSchema,
      }),
    "Lesson moved to draft",
  );
}

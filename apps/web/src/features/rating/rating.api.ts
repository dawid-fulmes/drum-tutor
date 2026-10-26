import {
  ApiErrorCode,
  ApiPaths,
  type LessonDetail,
  type LessonRating,
  LessonRatingSchema,
  withId,
} from "@drum-tutor/contracts";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { lessonKeys } from "../lessons/lesson-keys";

/** No `meta`: every failure toasts through the global handler (ADR-0021). */
export const rateLessonOptions = (queryClient: QueryClient, lessonId: string) => ({
  mutationFn: (rating: number) =>
    apiRequest(withId(ApiPaths.lessonRating, lessonId), {
      method: "PUT",
      body: { rating },
      schema: LessonRatingSchema,
    }),
  onSuccess: (result: LessonRating) => {
    queryClient.setQueryData<LessonDetail>(
      lessonKeys.library.detail(lessonId),
      (old) => old && { ...old, rating: result.rating, myRating: result.myRating },
    );
    return queryClient.invalidateQueries({ queryKey: [...lessonKeys.all, "library", "list"] });
  },
  onError: (error: Error) => {
    // A stale `canRate: true`: refetch so the button returns to disabled.
    if (error instanceof ApiClientError && error.code === ApiErrorCode.RATING_REQUIRES_COMPLETION) {
      return queryClient.invalidateQueries({ queryKey: lessonKeys.library.detail(lessonId) });
    }
  },
});

export function useRateLesson(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation(rateLessonOptions(queryClient, lessonId));
}

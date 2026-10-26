import type { LessonDetail, LessonRating } from "@drum-tutor/contracts";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { lessonKeys } from "../lessons/lesson-keys";
import { rateLessonOptions } from "./rating.api";

const LESSON_ID = "lesson-1";
const detailKey = lessonKeys.library.detail(LESSON_ID);

const cachedDetail = {
  id: LESSON_ID,
  name: "Basic groove",
  rating: { average: 4, count: 1 },
  myRating: null,
  canRate: true,
} as unknown as LessonDetail;

function setup(mutationFn: (rating: number) => Promise<LessonRating>) {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const observer = new MutationObserver<LessonRating, Error, number>(client, {
    ...rateLessonOptions(client, LESSON_ID),
    mutationFn,
  });
  return { client, invalidate, observer };
}

describe("rateLessonOptions", () => {
  it("writes the new rating into the cached detail and invalidates the library lists", async () => {
    const { client, invalidate, observer } = setup(() =>
      Promise.resolve({ rating: { average: 4.5, count: 2 }, myRating: 5 }),
    );
    client.setQueryData(detailKey, cachedDetail);

    await observer.mutate(5);

    expect(client.getQueryData<LessonDetail>(detailKey)).toEqual({
      ...cachedDetail,
      rating: { average: 4.5, count: 2 },
      myRating: 5,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["lessons", "library", "list"] });
  });

  it("does not write a partial object when the detail is not cached", async () => {
    const { client, observer } = setup(() =>
      Promise.resolve({ rating: { average: 4.5, count: 2 }, myRating: 5 }),
    );

    await observer.mutate(5);

    expect(client.getQueryData(detailKey)).toBeUndefined();
  });

  it("invalidates the detail when the API answers RATING_REQUIRES_COMPLETION", async () => {
    const { invalidate, observer } = setup(() =>
      Promise.reject(new ApiClientError(409, "RATING_REQUIRES_COMPLETION", "Complete it first")),
    );

    await observer.mutate(3).catch(() => undefined);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: detailKey });
  });

  it("leaves the detail alone on other failures", async () => {
    const { invalidate, observer } = setup(() =>
      Promise.reject(new ApiClientError(500, "INTERNAL_ERROR", "boom")),
    );

    await observer.mutate(3).catch(() => undefined);

    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: detailKey });
  });
});

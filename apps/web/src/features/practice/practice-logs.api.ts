import {
  ApiPaths,
  type PracticeLog,
  type PracticeLogInput,
  PracticeLogSchema,
} from "@drum-tutor/contracts";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { lessonKeys } from "../lessons/lesson-keys";

/** Stats query keys live under this root (plan 03's `statsKeys.all`). */
const STATS_ROOT_KEY = ["stats"] as const;

export const savePracticeLogOptions = (queryClient: QueryClient) => ({
  mutationFn: (input: PracticeLogInput) =>
    apiRequest(ApiPaths.practiceLogs, { method: "POST", body: input, schema: PracticeLogSchema }),
  // Never pause offline: the panel owns retries, and a paused mutation would still be sent after
  // the user chose to leave (ADR-0045).
  networkMode: "always" as const,
  meta: { suppressErrorToast: true },
  // The first saved session unlocks rating: refetch the lesson so `canRate` comes from the API
  // and the rate button turns active without a reload (US-12 → US-13).
  // Only the stats refetch is awaited; the detail refetch must not keep the panel on "Saving…".
  onSuccess: (_log: PracticeLog, input: PracticeLogInput) => {
    void queryClient.invalidateQueries({ queryKey: lessonKeys.library.detail(input.lessonId) });
    return queryClient.invalidateQueries({ queryKey: STATS_ROOT_KEY });
  },
});

/** Saves a completed session; the panel shows failures inline and retries (US-11b). */
export function useSavePracticeLog() {
  const queryClient = useQueryClient();
  return useMutation(savePracticeLogOptions(queryClient));
}

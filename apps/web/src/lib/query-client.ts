import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiClientError } from "./api-client";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { suppressErrorToast?: boolean };
  }
}

const isClientError = (error: unknown) =>
  error instanceof ApiClientError && error.status >= 400 && error.status < 500;

/** Failed mutations toast globally (ADR-0021); query errors are handled where they are used. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _onMutateResult, mutation) => {
        if (mutation.meta?.suppressErrorToast) return;
        toast.error(error instanceof ApiClientError ? error.message : "Something went wrong");
      },
    }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => !isClientError(error) && failureCount < 1,
      },
    },
  });
}

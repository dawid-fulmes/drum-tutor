import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiClientError } from "./api-client";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { suppressErrorToast?: boolean; suppressErrorCodes?: string[] };
  }
}

const isClientError = (error: unknown) =>
  error instanceof ApiClientError && error.status >= 400 && error.status < 500;

const isUnauthenticated = (error: unknown) =>
  error instanceof ApiClientError && error.status === 401;

/**
 * Failed mutations toast globally (ADR-0021); query errors are handled where they are used.
 * `meta.suppressErrorCodes` skips the toast for listed API error codes (the caller shows them inline).
 * A 401 (session lost) never toasts: it calls `onUnauthenticated`, before `suppressErrorToast` applies.
 */
export function createQueryClient({
  onUnauthenticated,
}: {
  onUnauthenticated: () => void;
}): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (isUnauthenticated(error)) onUnauthenticated();
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _onMutateResult, mutation) => {
        if (isUnauthenticated(error)) {
          onUnauthenticated();
          return;
        }
        if (mutation.meta?.suppressErrorToast) return;
        if (
          error instanceof ApiClientError &&
          mutation.meta?.suppressErrorCodes?.includes(error.code)
        ) {
          return;
        }
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

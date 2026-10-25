import { ApiClientError } from "@/lib/api-client";

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30_000;

/** Backoff before retry number `failures` (1 s, 2 s, 4 s … capped at 30 s, spec §6.2). */
export function retryDelayMs(failures: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** (failures - 1), RETRY_MAX_MS);
}

export type SaveErrorKind =
  | { kind: "retry" }
  | { kind: "reject"; reason: string }
  | { kind: "unauthenticated" };

/** Network and server failures are retried; client errors are final (US-11b, ADR-0045). */
export function classifySaveError(error: unknown): SaveErrorKind {
  if (!(error instanceof ApiClientError)) return { kind: "retry" };
  if (error.status === 401) return { kind: "unauthenticated" };
  if (error.status === 0 || error.status >= 500 || error.code === "UNKNOWN") {
    return { kind: "retry" };
  }
  if (error.status === 404)
    return { kind: "reject", reason: "This lesson is no longer available." };
  return { kind: "reject", reason: error.message };
}

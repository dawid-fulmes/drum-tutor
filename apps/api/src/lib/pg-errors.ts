export const PgErrorCode = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  /** Raised by `ON DELETE RESTRICT` (not 23503, which is NO ACTION / inserts). */
  RESTRICT_VIOLATION: "23001",
} as const;

function codeOf(value: unknown): unknown {
  return typeof value === "object" && value !== null && "code" in value
    ? (value as { code: unknown }).code
    : undefined;
}

/** Drizzle wraps driver errors, so the SQLSTATE can be on `error.code` or `error.cause.code`. */
export function hasPgErrorCode(error: unknown, code: string): boolean {
  if (codeOf(error) === code) return true;
  const cause =
    typeof error === "object" && error !== null && "cause" in error ? error.cause : undefined;
  return codeOf(cause) === code;
}

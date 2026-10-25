/** Escapes LIKE metacharacters so user input matches literally (default `\` escape). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/** `getNextPageParam` for the API's page envelope: `page + 1` while `page < totalPages`. */
export function nextPageParam(last: { page: number; totalPages: number }): number | undefined {
  return last.page < last.totalPages ? last.page + 1 : undefined;
}

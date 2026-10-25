import { AdminTagSchema, ApiPaths, pageSchema, type Tag, TagSchema } from "@drum-tutor/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { nextPageParam } from "@/lib/infinite";

const PICKER_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const tagKeys = {
  all: ["tags"] as const,
  search: (q: string) => [...tagKeys.all, "search", q] as const,
  byIds: (ids: readonly string[]) => [...tagKeys.all, "by-ids", ids] as const,
  admin: (q: string) => [...tagKeys.all, "admin", q] as const,
};

export const TagPageSchema = pageSchema(TagSchema);
export const AdminTagPageSchema = pageSchema(AdminTagSchema);

/** Infinite tag search for the picker (`GET /api/tags`, 20 per page). */
export function useTagSearch(q: string) {
  return useInfiniteQuery({
    queryKey: tagKeys.search(q),
    queryFn: ({ pageParam }) =>
      apiRequest(ApiPaths.tags, {
        query: { q, page: pageParam, pageSize: PICKER_PAGE_SIZE },
        schema: TagPageSchema,
      }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}

/** Resolves selected tag ids to tags in one request (ADR-0033); disabled for an empty list. */
export function useTagsByIds(ids: readonly string[]) {
  return useQuery({
    queryKey: tagKeys.byIds(ids),
    queryFn: async (): Promise<Tag[]> => {
      const page = await apiRequest(ApiPaths.tags, {
        query: { ids, pageSize: MAX_PAGE_SIZE },
        schema: TagPageSchema,
      });
      return page.items;
    },
    enabled: ids.length > 0,
  });
}

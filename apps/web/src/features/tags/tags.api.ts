import {
  AdminTagSchema,
  ApiErrorCode,
  ApiPaths,
  pageSchema,
  type Tag,
  type TagInput,
  TagSchema,
  withId,
} from "@drum-tutor/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { nextPageParam } from "@/lib/infinite";
import { lessonKeys } from "../lessons/lesson-keys";

const PICKER_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const tagKeys = {
  all: ["tags"] as const,
  search: (q: string) => [...tagKeys.all, "search", q] as const,
  // Sorted so a reordered selection reuses the cache entry.
  byIds: (ids: readonly string[]) => [...tagKeys.all, "by-ids", [...ids].sort()] as const,
  adminAll: ["tags", "admin"] as const,
  admin: (q: string) => [...tagKeys.adminAll, q] as const,
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

const ADMIN_PAGE_SIZE = 20;

/** Infinite admin tag list with `lessonCount` (`GET /api/admin/tags`, 20 per page). */
export function useAdminTags(q: string) {
  return useInfiniteQuery({
    queryKey: tagKeys.admin(q),
    queryFn: ({ pageParam }) =>
      apiRequest(ApiPaths.adminTags, {
        query: { q, page: pageParam, pageSize: ADMIN_PAGE_SIZE },
        schema: AdminTagPageSchema,
      }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}

const NAME_TAKEN_INLINE = { suppressErrorCodes: [ApiErrorCode.TAG_NAME_TAKEN] };

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TagInput) =>
      apiRequest(ApiPaths.adminTags, { method: "POST", body, schema: AdminTagSchema }),
    meta: NAME_TAKEN_INLINE,
    onSuccess: async () => {
      toast.success("Tag added");
      await queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}

export function useRenameTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiRequest(withId(ApiPaths.adminTag, id), {
        method: "PATCH",
        body: { name },
        schema: AdminTagSchema,
      }),
    meta: NAME_TAKEN_INLINE,
    onSuccess: async () => {
      toast.success("Tag renamed");
      // Lesson payloads embed tag names.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tagKeys.all }),
        queryClient.invalidateQueries({ queryKey: lessonKeys.all }),
      ]);
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(withId(ApiPaths.adminTag, id), { method: "DELETE", schema: null }),
    onSuccess: async () => {
      toast.success("Tag deleted");
      await queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
    // e.g. 409 TAG_IN_USE: refresh the row's lessonCount and Delete state.
    onError: () => queryClient.invalidateQueries({ queryKey: tagKeys.adminAll }),
  });
}

export function isTagNameTaken(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError && error.code === ApiErrorCode.TAG_NAME_TAKEN;
}

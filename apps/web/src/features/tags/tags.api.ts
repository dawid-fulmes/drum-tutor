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

/** A duplicate name is shown under the input by the caller; every other error toasts. */
function toastUnlessNameTaken(error: unknown) {
  if (error instanceof ApiClientError && error.code === ApiErrorCode.TAG_NAME_TAKEN) return;
  toast.error(error instanceof ApiClientError ? error.message : "Something went wrong");
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TagInput) =>
      apiRequest(ApiPaths.adminTags, { method: "POST", body, schema: AdminTagSchema }),
    meta: { suppressErrorToast: true },
    onSuccess: async () => {
      toast.success("Tag added");
      await queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
    onError: toastUnlessNameTaken,
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
    meta: { suppressErrorToast: true },
    onSuccess: async () => {
      toast.success("Tag renamed");
      await queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
    onError: toastUnlessNameTaken,
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
  });
}

export function isTagNameTaken(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError && error.code === ApiErrorCode.TAG_NAME_TAKEN;
}

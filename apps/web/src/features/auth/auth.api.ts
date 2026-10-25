import { ApiPaths, type LoginRequest, type User, UserSchema } from "@drum-tutor/contracts";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ApiClientError, apiRequest } from "@/lib/api-client";

export const meQueryKey = ["auth", "me"] as const;

/** The logged-in user, or null when the API says 401. Other errors propagate to the route. */
export const meQueryOptions = queryOptions({
  queryKey: meQueryKey,
  queryFn: async (): Promise<User | null> => {
    try {
      return await apiRequest(ApiPaths.me, { schema: UserSchema });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) return null;
      throw error;
    }
  },
  staleTime: Number.POSITIVE_INFINITY,
});

export function useLoginMutation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (body: LoginRequest) =>
      apiRequest(ApiPaths.login, { method: "POST", body, schema: UserSchema }),
    onSuccess: async (user) => {
      queryClient.setQueryData(meQueryKey, user);
      await navigate({ to: "/" });
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => apiRequest(ApiPaths.logout, { method: "POST", schema: null }),
    onSuccess: async () => {
      queryClient.clear();
      await navigate({ to: "/login" });
    },
  });
}

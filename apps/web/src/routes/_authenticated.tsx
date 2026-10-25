import { createFileRoute, redirect } from "@tanstack/react-router";
import { meQueryOptions } from "@/features/auth/auth.api";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogoutMutation } from "@/features/auth/auth.api";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function HomePage() {
  const { user } = Route.useRouteContext();
  const logout = useLogoutMutation();

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 p-6">
      <p>Logged in as {user.email}</p>
      <Button variant="outline" disabled={logout.isPending} onClick={() => logout.mutate()}>
        {logout.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Log out
      </Button>
    </main>
  );
}

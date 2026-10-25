import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogoutMutation } from "@/features/auth/auth.api";

export const Route = createFileRoute("/_authenticated/_app")({
  component: DrummerShell,
});

function DrummerShell() {
  const { user } = Route.useRouteContext();
  const logout = useLogoutMutation();

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-6 p-4">
          <span className="font-semibold">Drum Tutor</span>
          <nav className="flex flex-1 items-center gap-4 text-sm">
            <Link to="/" className="text-muted-foreground [&.active]:text-foreground">
              Library
            </Link>
          </nav>
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            {logout.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Log out
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminShell,
});

const navItems = [
  { to: "/admin/lessons", label: "Lessons" },
  { to: "/admin/tags", label: "Tags" },
] as const;

function AdminShell() {
  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <span className="font-semibold">Drum Tutor · Admin</span>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to app
          </Link>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:flex-row">
        <nav aria-label="Admin" className="flex gap-1 md:w-44 md:flex-col">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted [&.active]:bg-muted [&.active]:font-medium [&.active]:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { meQueryOptions } from "@/features/auth/auth.api";
import { LoginForm } from "@/features/auth/login-form";

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (user) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Drum Tutor</h1>
      <LoginForm />
    </main>
  );
}

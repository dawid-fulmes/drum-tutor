import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-4 p-6">
      <p role="alert" className="text-sm">
        {error instanceof Error && error.message ? error.message : "Something went wrong"}
      </p>
      <Button variant="outline" onClick={() => router.invalidate()}>
        Retry
      </Button>
    </main>
  );
}

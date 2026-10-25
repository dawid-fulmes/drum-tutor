import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-client";

type QueryErrorProps = {
  error: unknown;
  onRetry: () => void;
};

export function QueryError({ error, onRetry }: QueryErrorProps) {
  // The redirect to /login is already in progress (spec §6.2): no inline error.
  if (error instanceof ApiClientError && error.status === 401) return null;

  const message =
    error instanceof ApiClientError && error.message ? error.message : "Something went wrong";

  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertTitle>Could not load data</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>{message}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}

import { useBlocker } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Asks before leaving while a completed session is not saved (ADR-0045). The redirect to /login
 * after a lost session (401) is never blocked.
 */
export function LeaveGuard({ when }: { when: boolean }) {
  const blocker = useBlocker({
    shouldBlockFn: ({ next }) => when && next.pathname !== "/login",
    enableBeforeUnload: () => when,
    withResolver: true,
  });

  return (
    <AlertDialog open={blocker.status === "blocked"}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Your session isn't saved yet. Leave anyway?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset?.()}>Stay</AlertDialogCancel>
          <AlertDialogAction onClick={() => blocker.proceed?.()}>Leave</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

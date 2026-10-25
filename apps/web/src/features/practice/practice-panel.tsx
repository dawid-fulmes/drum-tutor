import { type LessonDetail, type PracticeLogInput, TempoBpmSchema } from "@drum-tutor/contracts";
import { type AnyFieldApi, useForm } from "@tanstack/react-form";
import { useEffect, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DurationField } from "@/features/admin-lessons/duration-field";
import { TempoField } from "@/features/admin-lessons/tempo-field";
import { formatDuration } from "@/features/lessons/duration";
import { todayLocal } from "@/lib/local-date";
import { remainingSeconds } from "./click-schedule";
import { LeaveGuard } from "./leave-guard";
import { Metronome } from "./metronome";
import { useSavePracticeLog } from "./practice-logs.api";
import {
  initialPracticeState,
  isRunning,
  isUnsaved,
  type PracticeSettings,
  practiceReducer,
} from "./practice-machine";
import { classifySaveError, retryDelayMs } from "./save-policy";

/** Tempo keeps its blur error until the typed value is valid (same rule as the lesson form). */
const clearTempoErrorWhenValid = {
  onChange: ({ value, fieldApi }: { value: unknown; fieldApi: AnyFieldApi }) => {
    if (!TempoBpmSchema.safeParse(value).success) return;
    fieldApi.setMeta((meta) => ({ ...meta, errorMap: { ...meta.errorMap, onBlur: undefined } }));
  },
};

/** Setup, count-in, play and saving of one practice session on the lesson page (spec §6.2). */
export function PracticePanel({ lesson }: { lesson: LessonDetail }) {
  const recommended: PracticeSettings = {
    tempoBpm: lesson.recommendedTempoBpm,
    durationSeconds: lesson.recommendedDurationSeconds,
  };
  const [state, dispatch] = useReducer(practiceReducer, recommended, initialPracticeState);
  const form = useForm({ defaultValues: recommended });
  const save = useSavePracticeLog();
  const [remaining, setRemaining] = useState(recommended.durationSeconds);

  // The settings of the running session, for the log built when the metronome completes.
  const session = useRef<PracticeSettings>(recommended);
  const [metronome] = useState(
    () =>
      new Metronome({
        onCountInDone: () => dispatch({ type: "count-in-done" }),
        onInterrupted: () => dispatch({ type: "stop", cause: "background" }),
        onComplete: () => {
          const completed = new Date();
          const log: PracticeLogInput = {
            idempotencyKey: crypto.randomUUID(),
            lessonId: lesson.id,
            ...session.current,
            completedAt: completed.toISOString(),
            localDate: todayLocal(),
          };
          dispatch({ type: "complete", log });
        },
      }),
  );

  // Leaving the page (another lesson, the library, unmount) silences the metronome at once.
  useEffect(() => () => metronome.stop(), [metronome]);

  const running = isRunning(state);

  // A hidden page or an unloading one stops the session; nothing is logged (US-11a, ADR-0044).
  useEffect(() => {
    if (!running) return;
    const stopInBackground = () => {
      metronome.stop();
      dispatch({ type: "stop", cause: "background" });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stopInBackground();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", stopInBackground);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", stopInBackground);
    };
  }, [running, metronome]);

  // The countdown is read from the audio clock; the frame loop only refreshes the display.
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const refresh = () => {
      const plan = metronome.plan;
      if (plan) setRemaining(remainingSeconds(plan, metronome.now()));
      frame = requestAnimationFrame(refresh);
    };
    frame = requestAnimationFrame(refresh);
    return () => cancelAnimationFrame(frame);
  }, [running, metronome]);

  // One request per attempt; StrictMode runs effects twice in development.
  const sent = useRef<string | null>(null);
  const { mutateAsync } = save;
  useEffect(() => {
    if (state.status !== "saving") return;
    const attempt = `${state.log.idempotencyKey}:${state.failures}`;
    if (sent.current === attempt) return;
    sent.current = attempt;
    mutateAsync(state.log).then(
      (log) => dispatch({ type: "save-succeeded", log }),
      (error: unknown) => {
        const result = classifySaveError(error);
        if (result.kind === "retry") dispatch({ type: "save-failed" });
        if (result.kind === "reject") dispatch({ type: "save-rejected", reason: result.reason });
        // "unauthenticated": the global handler redirects to /login.
      },
    );
  }, [state, mutateAsync]);

  // Automatic retries with backoff while the page is open (US-11b, ADR-0045).
  const failures = state.status === "save-failed" ? state.failures : 0;
  useEffect(() => {
    if (failures === 0) return;
    const timer = setTimeout(() => dispatch({ type: "retry" }), retryDelayMs(failures));
    return () => clearTimeout(timer);
  }, [failures]);

  const start = () => {
    const values = form.state.values;
    if (!TempoBpmSchema.safeParse(values.tempoBpm).success || state.status !== "setup") return;
    const settings = { tempoBpm: values.tempoBpm, durationSeconds: values.durationSeconds };
    session.current = settings;
    setRemaining(settings.durationSeconds);
    dispatch({ type: "start", settings });
    // Called inside the click, so the browser lets the AudioContext play.
    metronome.start(settings).catch(() => {
      metronome.stop();
      dispatch({ type: "stop", cause: "user" });
      toast.error("Audio could not start");
    });
  };

  const stop = () => {
    metronome.stop();
    dispatch({ type: "stop", cause: "user" });
  };

  return (
    <section aria-label="Practice" className="grid gap-4">
      <LeaveGuard when={isUnsaved(state)} />
      {state.status === "setup" && (
        <>
          {state.stoppedInBackground && (
            <p className="text-sm text-muted-foreground" role="status">
              Session stopped because the app was in the background. Nothing was logged.
            </p>
          )}
          <form.Field
            name="tempoBpm"
            validators={{ onBlur: TempoBpmSchema }}
            listeners={clearTempoErrorWhenValid}
          >
            {(field) => <TempoField field={field} />}
          </form.Field>
          <form.Field name="durationSeconds">
            {(field) => <DurationField field={field} />}
          </form.Field>
          <form.Subscribe selector={(s) => TempoBpmSchema.safeParse(s.values.tempoBpm).success}>
            {(valid) => (
              <Button
                type="button"
                className="justify-self-start"
                disabled={!valid}
                onClick={start}
              >
                Start
              </Button>
            )}
          </form.Subscribe>
        </>
      )}

      {running && (
        <div className="grid justify-items-start gap-2">
          <p className="text-sm text-muted-foreground">{state.settings.tempoBpm} BPM</p>
          <p className="font-mono text-5xl font-semibold tabular-nums" aria-live="off">
            {formatDuration(remaining)}
          </p>
          {state.status === "count-in" && <p className="text-sm font-medium">Count-in</p>}
          <Button type="button" variant="destructive" onClick={stop}>
            Stop
          </Button>
        </div>
      )}

      {state.status === "saving" && (
        <div role="status" className="grid gap-1">
          <p className="font-medium">Completed</p>
          <p className="text-sm text-muted-foreground">Saving your session…</p>
        </div>
      )}

      {state.status === "save-failed" && (
        <div role="status" className="grid justify-items-start gap-2">
          <p>Completed, but your session isn't saved yet. Retrying…</p>
          <Button type="button" variant="outline" onClick={() => dispatch({ type: "retry" })}>
            Retry now
          </Button>
        </div>
      )}

      {state.status === "saved" && (
        <div role="status" className="grid justify-items-start gap-2">
          <p>
            Completed — {formatDuration(state.log.durationSeconds)} at {state.log.tempoBpm} BPM
            logged.
          </p>
          <Button type="button" onClick={() => dispatch({ type: "practice-again" })}>
            Practice again
          </Button>
        </div>
      )}

      {state.status === "save-rejected" && (
        <div role="alert" className="grid justify-items-start gap-2">
          <p>Your session couldn't be saved: {state.reason}</p>
          <Button type="button" onClick={() => dispatch({ type: "practice-again" })}>
            Practice again
          </Button>
        </div>
      )}
    </section>
  );
}

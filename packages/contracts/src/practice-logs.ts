import { z } from "zod";
import { daysBetween, isLocalDate, LocalDateSchema, MIN_LOCAL_DATE } from "./dates";
import { DurationSecondsSchema, TempoBpmSchema } from "./lessons";

const COMPLETED_AT_MESSAGE = "Completion time must be an ISO 8601 date-time with offset";

/** A completed practice session (PRD §4.4). Retries resend the same `idempotencyKey` (ADR-0042). */
export const PracticeLogInputSchema = z
  .object({
    idempotencyKey: z.uuid(),
    lessonId: z.uuid(),
    durationSeconds: DurationSecondsSchema,
    tempoBpm: TempoBpmSchema,
    completedAt: z.iso
      .datetime({ offset: true, error: COMPLETED_AT_MESSAGE })
      .refine(
        (value) => new Date(value).getTime() >= Date.parse(`${MIN_LOCAL_DATE}T00:00:00Z`),
        `Completion time must be ${MIN_LOCAL_DATE} or later`,
      ),
    localDate: LocalDateSchema,
  })
  .refine(
    // ADR-0007: the client's local date must be within one day of the UTC date of completion.
    // Malformed fields already have their own issue; Zod 4 still runs object refinements then.
    (log) => {
      const completedAt = new Date(log.completedAt);
      if (Number.isNaN(completedAt.getTime()) || !isLocalDate(log.localDate)) return true;
      return Math.abs(daysBetween(completedAt.toISOString().slice(0, 10), log.localDate)) <= 1;
    },
    { path: ["localDate"], message: "Local date must be within one day of the completion time" },
  );
export type PracticeLogInput = z.input<typeof PracticeLogInputSchema>;

export const PracticeLogSchema = z.object({
  id: z.uuid(),
  lessonId: z.uuid(),
  durationSeconds: z.number().int(),
  tempoBpm: z.number().int(),
  completedAt: z.iso.datetime(),
  localDate: LocalDateSchema,
});
export type PracticeLog = z.infer<typeof PracticeLogSchema>;

import { LocalDateSchema } from "@drum-tutor/contracts";
import { z } from "zod";
import { todayLocal } from "@/lib/local-date";
import { STATS_PERIODS } from "./stats-period";

/** The stats screen's state lives in the URL; bad values fall back to defaults (spec §6.3). */
export const statsSearchSchema = z.object({
  tagId: z.uuid().optional().catch(undefined),
  period: z.enum(STATS_PERIODS).default("week").catch("week"),
  date: LocalDateSchema.default(todayLocal).catch(todayLocal),
});
export type StatsSearch = z.infer<typeof statsSearchSchema>;

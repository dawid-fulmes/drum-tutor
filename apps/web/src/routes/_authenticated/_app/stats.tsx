import { createFileRoute } from "@tanstack/react-router";
import { StatsPage } from "@/features/stats/stats-page";
import { statsSearchSchema } from "@/features/stats/stats-search";

export const Route = createFileRoute("/_authenticated/_app/stats")({
  validateSearch: statsSearchSchema,
  component: StatsPage,
});

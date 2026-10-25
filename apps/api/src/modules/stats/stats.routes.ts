import {
  ApiErrorSchema,
  ApiPaths,
  DailyStatsQuerySchema,
  DailyStatsSchema,
  WeeklyStatsQuerySchema,
  WeeklyStatsSchema,
} from "@drum-tutor/contracts";
import type { Database } from "@drum-tutor/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { currentUser, requireUser } from "../../plugins/auth";
import { getDailyStats, getWeeklyStats } from "./stats.repository";

const errorResponses = {
  400: ApiErrorSchema,
  401: ApiErrorSchema,
  404: ApiErrorSchema,
};

export const statsRoutes: FastifyPluginAsyncZod<{ db: Database }> = async (app, { db }) => {
  app.addHook("preHandler", requireUser);

  app.get(
    ApiPaths.statsDaily,
    {
      schema: {
        tags: ["stats"],
        summary: "Seconds practiced per day for one tag, every day of the range (at most 31 days)",
        querystring: DailyStatsQuerySchema,
        response: { 200: DailyStatsSchema, ...errorResponses },
      },
    },
    async (request) => getDailyStats(db, currentUser(request).id, request.query),
  );

  app.get(
    ApiPaths.statsWeekly,
    {
      schema: {
        tags: ["stats"],
        summary:
          "Seconds practiced per Monday–Sunday week for one tag, clipped to the range (at most 366 days)",
        querystring: WeeklyStatsQuerySchema,
        response: { 200: WeeklyStatsSchema, ...errorResponses },
      },
    },
    async (request) => getWeeklyStats(db, currentUser(request).id, request.query),
  );
};

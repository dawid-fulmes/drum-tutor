import {
  ApiErrorCode,
  ApiErrorSchema,
  ApiPaths,
  HealthResponseSchema,
} from "@drum-tutor/contracts";
import type { Database } from "@drum-tutor/db";
import { sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { apiError } from "../../plugins/error-handler";

export const healthRoutes: FastifyPluginAsyncZod<{ db: Database }> = async (app, { db }) => {
  app.get(
    ApiPaths.health,
    {
      schema: {
        tags: ["health"],
        response: { 200: HealthResponseSchema, 503: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      try {
        await db.execute(sql`select 1`);
      } catch (error) {
        request.log.warn({ err: error }, "Health check: database unavailable");
        return reply
          .code(503)
          .send(apiError(ApiErrorCode.SERVICE_UNAVAILABLE, "Database unavailable"));
      }
      return { status: "ok" as const };
    },
  );
};

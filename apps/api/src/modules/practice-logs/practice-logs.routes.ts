import {
  ApiErrorSchema,
  ApiPaths,
  PracticeLogInputSchema,
  PracticeLogSchema,
} from "@drum-tutor/contracts";
import type { Database } from "@drum-tutor/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { currentUser, requireUser } from "../../plugins/auth";
import { createPracticeLog } from "./practice-logs.repository";

export const practiceLogsRoutes: FastifyPluginAsyncZod<{ db: Database }> = async (app, { db }) => {
  app.addHook("preHandler", requireUser);

  app.post(
    ApiPaths.practiceLogs,
    {
      schema: {
        tags: ["practice"],
        summary:
          "Log a completed practice session; a repeated idempotency key returns the stored log",
        body: PracticeLogInputSchema,
        response: {
          200: PracticeLogSchema,
          201: PracticeLogSchema,
          400: ApiErrorSchema,
          401: ApiErrorSchema,
          404: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { log, created } = await createPracticeLog(db, currentUser(request).id, request.body);
      return reply.code(created ? 201 : 200).send(log);
    },
  );
};

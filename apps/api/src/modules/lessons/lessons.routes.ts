import {
  ApiErrorSchema,
  ApiPaths,
  IdParamsSchema,
  LessonDetailSchema,
  LessonSummarySchema,
  LibraryQuerySchema,
  pageSchema,
} from "@drum-tutor/contracts";
import type { Database } from "@drum-tutor/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireUser } from "../../plugins/auth";
import { getPublishedLesson, listLibrary } from "./library.repository";

export const lessonsRoutes: FastifyPluginAsyncZod<{ db: Database }> = async (app, { db }) => {
  app.addHook("preHandler", requireUser);

  app.get(
    ApiPaths.lessons,
    {
      schema: {
        tags: ["lessons"],
        summary: "Browse published lessons, filtered by tags (all) and difficulties (any)",
        querystring: LibraryQuerySchema,
        response: {
          200: pageSchema(LessonSummarySchema),
          400: ApiErrorSchema,
          401: ApiErrorSchema,
        },
      },
    },
    async (request) => listLibrary(db, request.query),
  );

  app.get(
    ApiPaths.lesson,
    {
      schema: {
        tags: ["lessons"],
        summary: "Get a published lesson",
        params: IdParamsSchema,
        response: {
          200: LessonDetailSchema,
          400: ApiErrorSchema,
          401: ApiErrorSchema,
          404: ApiErrorSchema,
        },
      },
    },
    async (request) => getPublishedLesson(db, request.params.id),
  );
};

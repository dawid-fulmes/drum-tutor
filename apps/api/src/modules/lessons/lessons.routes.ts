import {
  ApiErrorSchema,
  ApiPaths,
  IdParamsSchema,
  LessonDetailSchema,
  LessonRatingSchema,
  LessonSummarySchema,
  LibraryQuerySchema,
  pageSchema,
  RateLessonInputSchema,
} from "@drum-tutor/contracts";
import type { Database } from "@drum-tutor/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { currentUser, requireUser } from "../../plugins/auth";
import { getPublishedLesson, listLibrary } from "./library.repository";
import { rateLesson } from "./rating.repository";

export const lessonsRoutes: FastifyPluginAsyncZod<{ db: Database }> = async (app, { db }) => {
  app.addHook("preHandler", requireUser);

  app.get(
    ApiPaths.lessons,
    {
      schema: {
        tags: ["lessons"],
        summary:
          "Browse published lessons, filtered by tags (all) and difficulties (any), sorted by rating by default",
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
    async (request) => getPublishedLesson(db, request.params.id, currentUser(request).id),
  );

  app.put(
    ApiPaths.lessonRating,
    {
      schema: {
        tags: ["lessons"],
        summary: "Rate a lesson you have completed (1–5); writing again replaces the rating",
        params: IdParamsSchema,
        body: RateLessonInputSchema,
        response: {
          200: LessonRatingSchema,
          400: ApiErrorSchema,
          401: ApiErrorSchema,
          404: ApiErrorSchema,
          409: ApiErrorSchema,
        },
      },
    },
    async (request) =>
      rateLesson(db, currentUser(request).id, request.params.id, request.body.rating),
  );
};

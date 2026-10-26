import {
  AdminLessonSchema,
  AdminLessonSummarySchema,
  ApiErrorSchema,
  ApiPaths,
  IdParamsSchema,
  LessonInputSchema,
  PaginationQuerySchema,
  pageSchema,
} from "@drum-tutor/contracts";
import type { Database } from "@drum-tutor/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser } from "../../plugins/auth";
import {
  createLesson,
  deleteLesson,
  getAdminLesson,
  listAdminLessons,
  publishLesson,
  unpublishLesson,
  updateLesson,
} from "./admin-lessons.repository";

export const adminLessonsRoutes: FastifyPluginAsyncZod<{ db: Database }> = async (app, { db }) => {
  app.addHook("preHandler", requireUser);

  app.get(
    ApiPaths.adminLessons,
    {
      schema: {
        tags: ["admin-lessons"],
        summary: "List draft and published lessons, newest first",
        querystring: PaginationQuerySchema,
        response: {
          200: pageSchema(AdminLessonSummarySchema),
          400: ApiErrorSchema,
          401: ApiErrorSchema,
        },
      },
    },
    async (request) => listAdminLessons(db, request.query),
  );

  app.get(
    ApiPaths.adminLesson,
    {
      schema: {
        tags: ["admin-lessons"],
        summary: "Get a lesson, draft or published",
        params: IdParamsSchema,
        response: {
          200: AdminLessonSchema,
          400: ApiErrorSchema,
          401: ApiErrorSchema,
          404: ApiErrorSchema,
        },
      },
    },
    async (request) => getAdminLesson(db, request.params.id),
  );

  app.post(
    ApiPaths.adminLessons,
    {
      schema: {
        tags: ["admin-lessons"],
        summary: "Create a lesson as a draft",
        body: LessonInputSchema,
        response: {
          201: AdminLessonSchema,
          400: ApiErrorSchema,
          401: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => reply.code(201).send(await createLesson(db, request.body)),
  );

  app.put(
    ApiPaths.adminLesson,
    {
      schema: {
        tags: ["admin-lessons"],
        summary: "Replace a lesson's fields and tags; refused once it has practice logs",
        params: IdParamsSchema,
        body: LessonInputSchema,
        response: {
          200: AdminLessonSchema,
          400: ApiErrorSchema,
          401: ApiErrorSchema,
          404: ApiErrorSchema,
          409: ApiErrorSchema,
        },
      },
    },
    async (request) => updateLesson(db, request.params.id, request.body),
  );

  app.delete(
    ApiPaths.adminLesson,
    {
      schema: {
        tags: ["admin-lessons"],
        summary: "Delete a lesson that has no practice logs",
        params: IdParamsSchema,
        response: {
          204: z.undefined(),
          400: ApiErrorSchema,
          401: ApiErrorSchema,
          404: ApiErrorSchema,
          409: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      await deleteLesson(db, request.params.id);
      return reply.code(204).send();
    },
  );

  app.post(
    ApiPaths.adminLessonPublish,
    {
      schema: {
        tags: ["admin-lessons"],
        summary: "Publish a lesson (idempotent); refused while the signature has no notes",
        params: IdParamsSchema,
        response: {
          200: AdminLessonSchema,
          400: ApiErrorSchema,
          401: ApiErrorSchema,
          404: ApiErrorSchema,
          409: ApiErrorSchema,
        },
      },
    },
    async (request) => publishLesson(db, request.params.id),
  );

  app.post(
    ApiPaths.adminLessonUnpublish,
    {
      schema: {
        tags: ["admin-lessons"],
        summary: "Move a lesson back to draft; refused once it has practice logs",
        params: IdParamsSchema,
        response: {
          200: AdminLessonSchema,
          400: ApiErrorSchema,
          401: ApiErrorSchema,
          404: ApiErrorSchema,
          409: ApiErrorSchema,
        },
      },
    },
    async (request) => unpublishLesson(db, request.params.id),
  );
};

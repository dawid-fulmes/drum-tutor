import {
  AdminTagSchema,
  ApiErrorSchema,
  ApiPaths,
  IdParamsSchema,
  pageSchema,
  TagInputSchema,
  TagListQuerySchema,
} from "@drum-tutor/contracts";
import type { Database } from "@drum-tutor/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser } from "../../plugins/auth";
import { createTag, deleteTag, listAdminTags, renameTag } from "./tags.repository";

export const adminTagsRoutes: FastifyPluginAsyncZod<{ db: Database }> = async (app, { db }) => {
  app.addHook("preHandler", requireUser);

  app.get(
    ApiPaths.adminTags,
    {
      schema: {
        tags: ["admin-tags"],
        summary: "List tags with the number of lessons using each",
        querystring: TagListQuerySchema,
        response: {
          200: pageSchema(AdminTagSchema),
          400: ApiErrorSchema,
          401: ApiErrorSchema,
        },
      },
    },
    async (request) => listAdminTags(db, request.query),
  );

  app.post(
    ApiPaths.adminTags,
    {
      schema: {
        tags: ["admin-tags"],
        summary: "Create a tag",
        body: TagInputSchema,
        response: {
          201: AdminTagSchema,
          400: ApiErrorSchema,
          401: ApiErrorSchema,
          409: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => reply.code(201).send(await createTag(db, request.body.name)),
  );

  app.patch(
    ApiPaths.adminTag,
    {
      schema: {
        tags: ["admin-tags"],
        summary: "Rename a tag",
        params: IdParamsSchema,
        body: TagInputSchema,
        response: {
          200: AdminTagSchema,
          400: ApiErrorSchema,
          401: ApiErrorSchema,
          404: ApiErrorSchema,
          409: ApiErrorSchema,
        },
      },
    },
    async (request) => renameTag(db, request.params.id, request.body.name),
  );

  app.delete(
    ApiPaths.adminTag,
    {
      schema: {
        tags: ["admin-tags"],
        summary: "Delete a tag that no lesson uses",
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
      await deleteTag(db, request.params.id);
      return reply.code(204).send();
    },
  );
};

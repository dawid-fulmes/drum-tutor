import {
  ApiErrorSchema,
  ApiPaths,
  pageSchema,
  TagListQuerySchema,
  TagSchema,
} from "@drum-tutor/contracts";
import type { Database } from "@drum-tutor/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireUser } from "../../plugins/auth";
import { listTags } from "./tags.repository";

export const tagsRoutes: FastifyPluginAsyncZod<{ db: Database }> = async (app, { db }) => {
  app.addHook("preHandler", requireUser);

  app.get(
    ApiPaths.tags,
    {
      schema: {
        tags: ["tags"],
        summary: "List tags, searchable by name and filterable by ids",
        querystring: TagListQuerySchema,
        response: {
          200: pageSchema(TagSchema),
          400: ApiErrorSchema,
          401: ApiErrorSchema,
        },
      },
    },
    async (request) => listTags(db, request.query),
  );
};

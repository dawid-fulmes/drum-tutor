import { ApiErrorSchema, ApiPaths, LoginRequestSchema, UserSchema } from "@drum-tutor/contracts";
import type { Database } from "@drum-tutor/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { currentUser, requireUser } from "../../plugins/auth";
import { findOrCreateUserByEmail, toUserDto } from "./users.repository";

export const authRoutes: FastifyPluginAsyncZod<{ db: Database }> = async (app, { db }) => {
  app.post(
    ApiPaths.login,
    {
      schema: {
        tags: ["auth"],
        summary: "Log in by email; creates the user if the email is new",
        body: LoginRequestSchema,
        response: { 200: UserSchema, 400: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const user = toUserDto(await findOrCreateUserByEmail(db, request.body.email));
      reply.setSession(user.id);
      return user;
    },
  );

  app.get(
    ApiPaths.me,
    {
      schema: {
        tags: ["auth"],
        summary: "The logged-in user",
        response: { 200: UserSchema, 401: ApiErrorSchema },
      },
      preHandler: requireUser,
    },
    async (request) => currentUser(request),
  );

  app.post(
    ApiPaths.logout,
    {
      schema: {
        tags: ["auth"],
        summary: "Log out (idempotent)",
        response: { 204: z.undefined() },
      },
    },
    async (_request, reply) => {
      reply.clearSession();
      return reply.code(204).send();
    },
  );
};

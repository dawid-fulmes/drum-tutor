import { ApiErrorCode, type User } from "@drum-tutor/contracts";
import type { Database } from "@drum-tutor/db";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { findUserById, toUserDto } from "../modules/auth/users.repository";
import { apiError } from "./error-handler";

export const SESSION_COOKIE = "dt_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const UserIdSchema = z.uuid();

declare module "fastify" {
  interface FastifyInstance {
    resolveSessionUser(request: FastifyRequest, reply: FastifyReply): Promise<User | null>;
  }
  interface FastifyRequest {
    user: User | null;
  }
  interface FastifyReply {
    setSession(userId: string): FastifyReply;
    clearSession(): FastifyReply;
  }
}

/**
 * The single auth boundary (ADR-0001, ADR-0023): a signed cookie holding the user id.
 * Business routes use requireUser + currentUser(request); nothing else touches the cookie.
 */
export const authPlugin = fp<{ db: Database; isProduction: boolean }>(
  async (app: FastifyInstance, { db, isProduction }) => {
    const cookieOptions = {
      signed: true,
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
    } as const;

    app.decorateRequest("user", null);
    app.decorateReply("setSession", function (this: FastifyReply, userId: string) {
      return this.setCookie(SESSION_COOKIE, userId, {
        ...cookieOptions,
        maxAge: SESSION_MAX_AGE_SECONDS,
      });
    });
    app.decorateReply("clearSession", function (this: FastifyReply) {
      return this.clearCookie(SESSION_COOKIE, cookieOptions);
    });

    app.decorate("resolveSessionUser", async (request: FastifyRequest, reply: FastifyReply) => {
      const raw = request.cookies[SESSION_COOKIE];
      if (!raw) return null;

      const unsigned = request.unsignCookie(raw);
      const userId = unsigned.valid ? UserIdSchema.safeParse(unsigned.value) : null;
      if (!userId?.success) return null;

      const row = await findUserById(db, userId.data);
      if (!row) {
        // Valid cookie for a user that no longer exists (e.g. after db:reset).
        reply.clearSession();
        return null;
      }
      return toUserDto(row);
    });
  },
  { name: "auth", dependencies: ["@fastify/cookie"] },
);

/**
 * preHandler guard for routes that need a logged-in user. The session is resolved only here, so
 * routes without it (health, logout, docs) never touch the database for the cookie.
 */
export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  request.user = await request.server.resolveSessionUser(request, reply);
  if (!request.user) {
    return reply.code(401).send(apiError(ApiErrorCode.UNAUTHENTICATED, "Not logged in"));
  }
}

/** The current user in a route guarded by requireUser. */
export function currentUser(request: FastifyRequest): User {
  if (!request.user) {
    throw new Error("currentUser() used on a route without requireUser");
  }
  return request.user;
}

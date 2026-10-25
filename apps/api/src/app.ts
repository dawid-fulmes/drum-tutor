import type { Database } from "@drum-tutor/db";
import fastifyCookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { authRoutes } from "./modules/auth/auth.routes";
import { healthRoutes } from "./modules/health/health.routes";
import { authPlugin } from "./plugins/auth";
import { errorHandlerPlugin } from "./plugins/error-handler";
import { openApiPlugin } from "./plugins/openapi";

export interface BuildAppOptions {
  db: Database;
  cookieSecret: string;
  isProduction: boolean;
  logger?: boolean;
}

/** Builds the Fastify app without listening, so tests can use inject(). */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(fastifyCookie, { secret: options.cookieSecret });
  await app.register(errorHandlerPlugin);
  await app.register(openApiPlugin);
  await app.register(authPlugin, { db: options.db, isProduction: options.isProduction });

  await app.register(healthRoutes, { db: options.db });
  await app.register(authRoutes, { db: options.db });

  return app;
}

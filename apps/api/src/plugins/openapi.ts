import { ApiPaths } from "@drum-tutor/contracts";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

/** OpenAPI generated from the route Zod schemas, served at /api/docs (ADR-0014). */
export const openApiPlugin = fp(async (app: FastifyInstance) => {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.1.0",
      info: { title: "Drum Tutor API", version: "0.0.0" },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(fastifySwaggerUi, { routePrefix: ApiPaths.docs });
});

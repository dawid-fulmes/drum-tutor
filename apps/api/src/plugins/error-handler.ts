import { type ApiError, ApiErrorCode } from "@drum-tutor/contracts";
import type { FastifyError, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";

export function apiError(
  code: string,
  message: string,
  details?: ApiError["error"]["details"],
): ApiError {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

/** A domain error with a stable code; the error handler sends it as an ApiError (ADR-0022). */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: ApiError["error"]["details"],
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Maps every error and unknown route to the shared ApiError shape (ADR-0022). */
export const errorHandlerPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(apiError(error.code, error.message, error.details));
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const details = error.validation.map((issue) => ({
        path:
          issue.instancePath.replace(/^\//, "").replaceAll("/", ".") ||
          (error.validationContext ?? ""),
        message: issue.message ?? "Invalid value",
      }));
      return reply
        .code(400)
        .send(apiError(ApiErrorCode.VALIDATION_ERROR, "Invalid request", details));
    }

    const statusCode = typeof error.statusCode === "number" ? error.statusCode : 500;
    if (statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send(apiError(ApiErrorCode.BAD_REQUEST, "Invalid request"));
    }

    request.log.error({ err: error }, "Unhandled error");
    return reply.code(500).send(apiError(ApiErrorCode.INTERNAL_ERROR, "Internal server error"));
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send(apiError(ApiErrorCode.NOT_FOUND, "Not found"));
  });
});

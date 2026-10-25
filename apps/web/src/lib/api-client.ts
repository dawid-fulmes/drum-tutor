import { ApiErrorSchema } from "@drum-tutor/contracts";
import type { z } from "zod";

type ErrorDetails = { path: string; message: string }[];

/** Every failed API call surfaces as this error (ADR-0022, ADR-0025). */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ErrorDetails,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export type QueryParams = Record<string, string | number | readonly string[] | undefined>;

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: QueryParams;
  body?: unknown;
};

/** Appends query params: arrays become repeated keys; undefined, "" and empty arrays are omitted. */
export function buildUrl(path: string, query?: QueryParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === "") continue;
    if (typeof value === "object") {
      for (const item of value) params.append(key, item);
    } else {
      params.append(key, String(value));
    }
  }
  const search = params.toString();
  return search === "" ? path : `${path}?${search}`;
}

/**
 * Thin typed fetch wrapper (ADR-0025). Success bodies are parsed with the contract schema;
 * nothing is filled in or guessed when the API response does not match the contract.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions & { schema: z.ZodType<T> },
): Promise<T>;
export async function apiRequest(
  path: string,
  options: RequestOptions & { schema: null },
): Promise<void>;
export async function apiRequest<T>(
  path: string,
  { method = "GET", query, body, schema }: RequestOptions & { schema: z.ZodType<T> | null },
): Promise<T | undefined> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError(0, "NETWORK_ERROR", "Cannot reach the server");
  }

  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(await readJson(response));
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiClientError(response.status, code, message, details);
    }
    // The API always answers with ApiError, so anything else came from in between (e.g. the dev proxy).
    throw new ApiClientError(response.status, "UNKNOWN", "Cannot reach the server");
  }

  if (schema === null) {
    return undefined;
  }
  const parsed = schema.safeParse(await readJson(response));
  if (!parsed.success) {
    throw new ApiClientError(
      response.status,
      "INVALID_RESPONSE",
      "Unexpected response from the server",
    );
  }
  return parsed.data;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

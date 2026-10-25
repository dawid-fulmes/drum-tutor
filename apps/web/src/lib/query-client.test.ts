import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "./api-client";
import { createQueryClient } from "./query-client";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const unauthenticated = () => new ApiClientError(401, "UNAUTHENTICATED", "Not logged in");

function runMutation(
  client: QueryClient,
  error: unknown,
  meta?: { suppressErrorToast?: boolean; suppressErrorCodes?: string[] },
) {
  const mutation = client.getMutationCache().build(client, {
    mutationFn: async () => {
      throw error;
    },
    meta,
  });
  return mutation.execute(undefined).catch(() => undefined);
}

describe("createQueryClient", () => {
  const onUnauthenticated = vi.fn();
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createQueryClient({ onUnauthenticated });
  });

  it("401 from a mutation calls onUnauthenticated and does not toast", async () => {
    await runMutation(client, unauthenticated());
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("401 from a query calls onUnauthenticated once, without retry", async () => {
    const queryFn = vi.fn(async () => {
      throw unauthenticated();
    });
    await client.fetchQuery({ queryKey: ["x"], queryFn }).catch(() => undefined);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("other mutation errors still toast with the API message", async () => {
    await runMutation(client, new ApiClientError(409, "CONFLICT", "Lesson is locked"));
    expect(toast.error).toHaveBeenCalledWith("Lesson is locked");
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("suppressErrorToast suppresses the toast but not the 401 redirect", async () => {
    await runMutation(client, new ApiClientError(409, "CONFLICT", "x"), {
      suppressErrorToast: true,
    });
    expect(toast.error).not.toHaveBeenCalled();
    await runMutation(client, unauthenticated(), { suppressErrorToast: true });
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("suppressErrorCodes skips the toast only for listed codes", async () => {
    const meta = { suppressErrorCodes: ["TAG_NAME_TAKEN"] };
    await runMutation(client, new ApiClientError(409, "TAG_NAME_TAKEN", "taken"), meta);
    expect(toast.error).not.toHaveBeenCalled();
    await runMutation(client, new ApiClientError(500, "INTERNAL", "Boom"), meta);
    expect(toast.error).toHaveBeenCalledWith("Boom");
  });

  it("401 with suppressErrorCodes redirects and does not toast", async () => {
    await runMutation(client, unauthenticated(), { suppressErrorCodes: ["TAG_NAME_TAKEN"] });
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });
});

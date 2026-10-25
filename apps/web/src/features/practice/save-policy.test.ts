import { describe, expect, it } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { classifySaveError, retryDelayMs } from "./save-policy";

describe("retryDelayMs", () => {
  it("doubles from 1 s and caps at 30 s", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(retryDelayMs)).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000,
    ]);
  });
});

describe("classifySaveError", () => {
  it("retries network errors, server errors and unknown failures", () => {
    expect(classifySaveError(new ApiClientError(0, "NETWORK_ERROR", "x"))).toEqual({
      kind: "retry",
    });
    expect(classifySaveError(new ApiClientError(503, "SERVICE_UNAVAILABLE", "x"))).toEqual({
      kind: "retry",
    });
    expect(classifySaveError(new ApiClientError(502, "UNKNOWN", "x"))).toEqual({ kind: "retry" });
    expect(classifySaveError(new TypeError("x"))).toEqual({ kind: "retry" });
  });

  it("leaves a lost session to the global redirect", () => {
    expect(classifySaveError(new ApiClientError(401, "UNAUTHENTICATED", "x"))).toEqual({
      kind: "unauthenticated",
    });
  });

  it("rejects client errors with a reason", () => {
    expect(classifySaveError(new ApiClientError(404, "NOT_FOUND", "Lesson not found"))).toEqual({
      kind: "reject",
      reason: "This lesson is no longer available.",
    });
    expect(
      classifySaveError(new ApiClientError(400, "VALIDATION_ERROR", "Invalid request")),
    ).toEqual({ kind: "reject", reason: "Invalid request" });
  });
});

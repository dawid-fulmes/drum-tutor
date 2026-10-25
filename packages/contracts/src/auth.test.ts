import { describe, expect, it } from "vitest";
import { ApiErrorSchema } from "./api-error";
import { EmailSchema, LoginRequestSchema } from "./auth";

describe("EmailSchema", () => {
  it("trims and lowercases", () => {
    expect(EmailSchema.parse("  Jan.Kowalski@Example.COM ")).toBe("jan.kowalski@example.com");
  });

  it.each(["", "   ", "not-an-email", "a@", "@example.com", `${"a".repeat(250)}@example.com`])(
    "rejects %j",
    (value) => {
      expect(EmailSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("LoginRequestSchema", () => {
  it("rejects a missing email", () => {
    expect(LoginRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("ApiErrorSchema", () => {
  it("accepts an error without details", () => {
    expect(
      ApiErrorSchema.safeParse({ error: { code: "NOT_FOUND", message: "Not found" } }).success,
    ).toBe(true);
  });
});

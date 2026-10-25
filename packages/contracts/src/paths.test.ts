import { describe, expect, it } from "vitest";
import { ApiPaths, withId } from "./paths";

describe("withId", () => {
  it("URL-encodes the id", () => {
    expect(withId(ApiPaths.lesson, "a/b")).toBe("/api/lessons/a%2Fb");
  });

  it("inserts replacement patterns literally", () => {
    expect(withId(ApiPaths.lesson, "$&")).toBe("/api/lessons/%24%26");
    expect(withId(ApiPaths.lesson, "$'x")).toBe("/api/lessons/%24'x");
  });
});

import { describe, expect, it } from "vitest";
import { formatDifficulty } from "./format";

describe("formatDifficulty", () => {
  it.each([
    ["beginner", "Beginner"],
    ["intermediate", "Intermediate"],
    ["advanced", "Advanced"],
  ] as const)("labels %s as %s", (difficulty, label) => {
    expect(formatDifficulty(difficulty)).toBe(label);
  });
});

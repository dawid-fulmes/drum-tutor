import { describe, expect, it } from "vitest";
import { EMPTY_SIGNATURE_V1, SignatureSchema, signatureHasNotes } from "./signature";

const slot = (instruments: string[] = [], comment = "") => ({ instruments, comment });
const sig = <T>(slots: T[]) => ({ version: "v1", slots });
const rests = (n: number) => Array.from({ length: n }, () => slot());
const money = sig([
  slot(["hihat-closed", "kick"]),
  slot(["hihat-closed"]),
  slot(["hihat-closed", "snare"]),
  slot(["hihat-closed"]),
  slot(["hihat-closed", "kick"]),
  slot(["hihat-closed"]),
  slot(["hihat-closed", "snare"]),
  slot(["hihat-closed"]),
]);
const firstIssue = (value: unknown) => SignatureSchema.safeParse(value).error?.issues[0];

describe("SignatureSchema", () => {
  it("accepts a money beat and the empty signature", () => {
    expect(SignatureSchema.safeParse(money).success).toBe(true);
    expect(SignatureSchema.safeParse(EMPTY_SIGNATURE_V1).success).toBe(true);
  });

  it.each([7, 9])("rejects %i slots", (n) => {
    expect(firstIssue(sig(rests(n)))?.message).toBe("A signature has exactly 8 slots");
  });

  it("rejects an unknown instrument with only that message", () => {
    const issues = SignatureSchema.safeParse(sig([slot(["snare", "tom"]), ...rests(7)])).error
      ?.issues;
    expect(issues?.map((i) => i.message)).toEqual(["Unknown instrument"]);
    expect(issues?.[0]?.path).toEqual(["slots", 0, "instruments", 1]);
  });

  it("rejects a duplicate instrument", () => {
    expect(firstIssue(sig([slot(["snare", "snare"]), ...rests(7)]))?.message).toBe(
      "An instrument can only appear once in a slot",
    );
  });

  it("trims comments and limits them to 3 characters", () => {
    const parsed = SignatureSchema.parse(
      sig([slot(["snare"], " R "), slot([], "   "), ...rests(6)]),
    );
    expect(parsed.slots[0]?.comment).toBe("R");
    expect(parsed.slots[1]?.comment).toBe("");
    expect(firstIssue(sig([slot([], "RLRL"), ...rests(7)]))).toMatchObject({
      path: ["slots", 0, "comment"],
      message: "A comment can be at most 3 characters",
    });
  });

  it("rejects a missing or unknown version", () => {
    expect(SignatureSchema.safeParse({ slots: money.slots }).success).toBe(false);
    expect(SignatureSchema.safeParse({ ...money, version: "v2" }).success).toBe(false);
  });

  it("drops unknown keys", () => {
    const parsed = SignatureSchema.parse({
      ...money,
      bpm: 90,
      slots: money.slots.map((s) => ({ ...s, accent: true })),
    });
    expect(parsed).toEqual(money);
  });
});

describe("signatureHasNotes", () => {
  it("tells whether a signature has notes", () => {
    expect(signatureHasNotes(EMPTY_SIGNATURE_V1)).toBe(false);
    expect(
      signatureHasNotes(SignatureSchema.parse(sig([slot(), slot(["kick"]), ...rests(6)]))),
    ).toBe(true);
  });
});

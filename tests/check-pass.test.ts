import { describe, expect, it } from "vitest";
import { passFaults } from "../scripts/check-pass.mjs";
import { PASS_MARKER } from "../scripts/merge-gate.mjs";

const comment = (body: string) => ({ path: "a.ts", line: 3, body });

describe("passFaults", () => {
  it("accepts a marked body and marked comments", () => {
    const pass = {
      body: `${PASS_MARKER}\nsummary`,
      comments: [comment("**comment** — a nit"), comment("**critical** — wrong")],
    };
    expect(passFaults(pass)).toEqual([]);
  });

  it("accepts a pass that found nothing", () => {
    expect(passFaults({ body: PASS_MARKER })).toEqual([]);
  });

  it.each(["comment: a nit", "`critical` — wrong", "**Critical** — wrong", " **warning** — x"])(
    "names a comment the gate reads as unreadable: %s",
    (body) => {
      expect(passFaults({ body: PASS_MARKER, comments: [comment(body)] })).toEqual([
        "a.ts:3 does not open with **critical**, **warning** or **comment**",
      ]);
    },
  );

  it("names a body without the pass marker", () => {
    expect(passFaults({ body: "findings" })).toHaveLength(1);
  });
});

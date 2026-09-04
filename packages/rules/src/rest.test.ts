import { describe, expect, it } from "vitest";
import { resetsOn } from "./rest.ts";

describe("resetsOn", () => {
  it.each([
    ["restShort", "short"],
    ["restLong", "long"],
    ["dawn", "dawn"],
  ] as const)("maps %s to %s", (recharge, expected) => {
    expect(resetsOn(recharge)).toBe(expected);
  });

  it.each(["dusk", "midnight", "special", "", "consumed"])("degrades %s to manual", (recharge) => {
    expect(resetsOn(recharge)).toBe("manual");
  });

  it.each(["constructor", "toString", "hasOwnProperty"])(
    "degrades the inherited key %s to manual",
    (recharge) => {
      expect(resetsOn(recharge)).toBe("manual");
    },
  );

  it.each([null, undefined])("degrades %s to manual", (recharge) => {
    expect(resetsOn(recharge)).toBe("manual");
  });
});

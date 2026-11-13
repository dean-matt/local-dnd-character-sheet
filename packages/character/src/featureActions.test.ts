import { describe, expect, it } from "vitest";
import { featureActionType } from "./featureActions.ts";

describe("featureActionType", () => {
  it("names the action a curated feature takes, by source", () => {
    expect(featureActionType({ name: "Second Wind", source: "XPHB" })).toBe("bonus action");
    expect(featureActionType({ name: "Action Surge", source: "PHB" })).toBe("free");
    expect(featureActionType({ name: "Uncanny Dodge", source: "PHB" })).toBe("reaction");
    expect(featureActionType({ name: "Wild Shape", source: "PHB" })).toBe("action");
  });

  it("is undefined for a feature the table omits", () => {
    expect(featureActionType({ name: "Second Wind", source: "HB" })).toBeUndefined();
    expect(featureActionType({ name: "Fighting Style", source: "PHB" })).toBeUndefined();
  });
});

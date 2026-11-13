import { describe, expect, it } from "vitest";
import { featureActionType, featurePoolKey } from "./featureActions.ts";

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

describe("featurePoolKey", () => {
  it("names the class pool a feature spends, by source", () => {
    expect(featurePoolKey({ name: "Rage", source: "PHB" })).toBe("rages");
    expect(featurePoolKey({ name: "Flurry of Blows", source: "PHB" })).toBe("ki_points");
    expect(featurePoolKey({ name: "Flurry of Blows", source: "XPHB" })).toBe("focus_points");
  });

  it("is undefined for a feature that spends no pool", () => {
    expect(featurePoolKey({ name: "Second Wind", source: "PHB" })).toBeUndefined();
    expect(featurePoolKey({ name: "Action Surge", source: "XPHB" })).toBeUndefined();
  });
});

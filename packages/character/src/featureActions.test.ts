import { describe, expect, it } from "vitest";
import {
  ACTION_TURN_MARK,
  featureActionType,
  featureCost,
  featureCostRecorded,
  featurePoolKey,
} from "./featureActions.ts";

describe("featureActionType", () => {
  it("names the action a curated feature takes, by source", () => {
    expect(featureActionType({ name: "Second Wind", source: "XPHB" })).toBe("bonus action");
    expect(featureActionType({ name: "Action Surge", source: "PHB" })).toBe("free");
    expect(featureActionType({ name: "Uncanny Dodge", source: "PHB" })).toBe("reaction");
    expect(featureActionType({ name: "Wild Shape", source: "PHB" })).toBe("action");
    expect(featureActionType({ name: "Favored Enemy", source: "XPHB" })).toBe("bonus action");
    expect(featureActionType({ name: "Sacred Weapon", source: "XPHB" })).toBe("free");
    expect(featureActionType({ name: "Hand of Healing", source: "TCE" })).toBe("action");
    expect(featureActionType({ name: "Unearthly Recovery", source: "XGE" })).toBe("bonus action");
    expect(featureActionType({ name: "Soul of Artifice", source: "TCE" })).toBe("reaction");
    expect(
      featureActionType({ name: "Channel Divinity: Harness Divine Power", source: "TCE" }),
    ).toBe("bonus action");
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
    expect(featurePoolKey({ name: "Sacred Weapon", source: "XPHB" })).toBe("channel_divinity");
    expect(featurePoolKey({ name: "Favored Enemy", source: "XPHB" })).toBe("favored_enemy");
    expect(featurePoolKey({ name: "Hand of Healing", source: "TCE" })).toBe("ki_points");
    expect(featurePoolKey({ name: "Channel Divinity: Twilight Sanctuary", source: "TCE" })).toBe(
      "channel_divinity",
    );
    expect(featurePoolKey({ name: "Channel Divinity: Preserve Life", source: "PHB" })).toBe(
      "channel_divinity",
    );
  });

  it("is undefined for a feature that spends no pool", () => {
    expect(featurePoolKey({ name: "Second Wind", source: "PHB" })).toBeUndefined();
    expect(featurePoolKey({ name: "Action Surge", source: "XPHB" })).toBeUndefined();
  });

  it("is undefined for a feature only the 2014 classes hold, whose tables carry no pool", () => {
    expect(featurePoolKey({ name: "Channel Divinity", source: "PHB" })).toBeUndefined();
    expect(featurePoolKey({ name: "Wild Shape", source: "PHB" })).toBeUndefined();
    expect(featurePoolKey({ name: "Symbiotic Entity", source: "TCE" })).toBeUndefined();
  });
});

describe("featureCost", () => {
  it("prices a feature in its pool, what a use spends at least and at most", () => {
    expect(featureCost({ name: "Stunning Strike", source: "PHB" })).toEqual({
      pool: "ki_points",
      min: 1,
    });
    expect(featureCost({ name: "Empty Body", source: "PHB" })).toEqual({
      pool: "ki_points",
      min: 4,
      max: 8,
    });
    expect(featureCost({ name: "Twinned Spell", source: "PHB" })).toEqual({
      pool: "sorcery_points",
      min: 1,
      max: 9,
    });
    expect(featureCost({ name: "Revelation in Flesh", source: "TCE" })).toEqual({
      pool: "sorcery_points",
      min: 1,
      max: null,
    });
    expect(featureCost({ name: "Riposte", source: "PHB" })).toEqual({
      pool: "superiority_dice",
      min: 1,
    });
    expect(featureCost({ name: "Turn Undead", source: "XPHB" })).toBeUndefined();
  });

  it("prices the Psionic Energy dice from the uses of Psionic Power", () => {
    expect(featureCost({ name: "Psionic Strike", source: "TCE" })).toEqual({
      feature: "Psionic Power",
      min: 1,
    });
  });

  it("is recorded for a priced feature and one whose cost is the player's to spend", () => {
    expect(featureCostRecorded({ name: "Quickened Spell", source: "PHB" })).toBe(true);
    expect(featureCostRecorded({ name: "Rend Mind", source: "TCE" })).toBe(true);
    expect(featureCostRecorded({ name: "Rend Mind", source: "PHB" })).toBe(false);
  });

  it("lists a pool-priced feature without an action of its own as a free one", () => {
    expect(featureActionType({ name: "Careful Spell", source: "PHB" })).toBe("free");
    expect(featureActionType({ name: "Flurry of Blows", source: "PHB" })).toBe("bonus action");
  });
});

describe("ACTION_TURN_MARK", () => {
  it("marks the turn slot an action type spends, and none for a free action", () => {
    expect(ACTION_TURN_MARK).toEqual({
      action: "action",
      "bonus action": "bonusAction",
      reaction: "reaction",
      free: undefined,
    });
  });
});

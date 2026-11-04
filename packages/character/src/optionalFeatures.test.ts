import { describe, expect, it } from "vitest";
import {
  type OptionalFeatureEntitlement,
  optionalFeatureTallies,
  spareEntitlement,
} from "./index.ts";

const BATTLE_MASTER = {
  kind: "subclass",
  ref: { name: "Battle Master", source: "PHB" },
  class: { name: "Fighter", source: "PHB" },
} as const;
const MARTIAL_ADEPT = { kind: "feat", ref: { name: "Martial Adept", source: "PHB" } } as const;

const entitlements: OptionalFeatureEntitlement[] = [
  { featureType: "MV:B", known: 3, grantedBy: BATTLE_MASTER, edition: "classic" },
  { featureType: "MV:B", known: 2, grantedBy: MARTIAL_ADEPT, edition: "classic" },
];

const maneuver = (name: string, grantedBy: OptionalFeatureEntitlement["grantedBy"]) => ({
  ref: { name, source: "PHB" },
  featureType: "MV:B",
  grantedBy,
});

describe("optional feature tallies", () => {
  it("sums a type's entitlements across grantors", () => {
    const [tally] = optionalFeatureTallies([], entitlements);
    expect(tally).toMatchObject({ featureType: "MV:B", known: 5, picks: [] });
  });

  it("reports a pick of a type nothing entitles any longer with a total of none", () => {
    const pick = { ...maneuver("Archery", BATTLE_MASTER), featureType: "FS:F" };
    expect(optionalFeatureTallies([pick], entitlements).at(-1)).toEqual({
      featureType: "FS:F",
      entitlements: [],
      known: 0,
      picks: [pick],
    });
  });
});

describe("spare entitlement", () => {
  it("spends the first grantor that has picks to spare", () => {
    const picks = ["Parry", "Riposte", "Feint"].map((name) => maneuver(name, BATTLE_MASTER));
    const [tally] = optionalFeatureTallies(picks, entitlements);
    expect(tally && spareEntitlement(tally)?.grantedBy).toEqual(MARTIAL_ADEPT);
  });

  it("tells two homebrew subclasses apart, and a subclass from its class", () => {
    const warden = { kind: "class", ref: { homebrewId: "hb_08" } } as const;
    const subclass = (homebrewId: string) =>
      ({ kind: "subclass", ref: { homebrewId }, class: warden.ref }) as const;
    const granted: OptionalFeatureEntitlement[] = [
      { featureType: "MV:B", known: 1, grantedBy: warden, edition: "one" },
      { featureType: "MV:B", known: 1, grantedBy: subclass("hb_09"), edition: "one" },
      { featureType: "MV:B", known: 1, grantedBy: subclass("hb_10"), edition: "one" },
    ];
    const picks = [maneuver("Parry", warden), maneuver("Riposte", subclass("hb_09"))];
    const [tally] = optionalFeatureTallies(picks, granted);
    expect(tally && spareEntitlement(tally)?.grantedBy).toEqual(subclass("hb_10"));
  });

  it("names the first grantor once every one is spent", () => {
    const picks = [
      ...["Parry", "Riposte", "Feint"].map((name) => maneuver(name, BATTLE_MASTER)),
      ...["Rally", "Lunging Attack"].map((name) => maneuver(name, MARTIAL_ADEPT)),
    ];
    const [tally] = optionalFeatureTallies(picks, entitlements);
    expect(tally && spareEntitlement(tally)?.grantedBy).toEqual(BATTLE_MASTER);
  });
});

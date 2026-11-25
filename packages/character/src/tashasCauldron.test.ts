import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import { featureLimitedUses } from "./featureLimitedUses.ts";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";
import { heldFeatures, SUBCLASS_NAMES } from "./heldFeatures.ts";
import { classFeatureUsesKey } from "./keys.ts";
import { definition } from "./test/vex.ts";

const subclassOf = (
  className: string,
  subclass: string,
  count: number,
  subclassLevel: number,
): CharacterDefinition => ({
  ...definition,
  edition: "classic",
  feats: [],
  optionalFeatures: [],
  levels: Array.from({ length: count }, (_, index) => ({
    class: { name: className, source: "PHB" },
    ...(index === subclassLevel - 1 ? { subclass: { name: subclass, source: "TCE" } } : {}),
  })),
});

describe("a Psi Warrior at 7th level", () => {
  const psiWarrior = subclassOf("Fighter", "Psi Warrior", 7, 3);

  it("counts a short-rest use of Psi-Powered Leap", () => {
    expect(
      featureLimitedUses(psiWarrior, () => 0)
        .filter(({ feature }) => feature.name === "Psi-Powered Leap")
        .map(({ count, reset }) => ({ count, reset })),
    ).toEqual([{ count: 1, reset: "short" }]);
  });
});

const subclassRecords = FEATURE_MECHANICS.flatMap(({ ref, offeredBy }) =>
  ref.source === "TCE" && "className" in ref && ref.subclass && !offeredBy ? [ref] : [],
);

describe("a TCE subclass feature record", () => {
  it("is held by a character of its subclass at its level, and not a level before", () => {
    expect(subclassRecords.length).toBeGreaterThan(50);
    for (const ref of subclassRecords) {
      const subclass = SUBCLASS_NAMES.get(`${ref.subclass?.shortName}|${ref.subclass?.source}`);
      expect(subclass, `${ref.name} has no subclass mapping`).toBeDefined();
      const [name = "", source = ""] = (subclass ?? "").split("|");
      const heldAt = (level: number) =>
        heldFeatures({
          ...definition,
          feats: [],
          optionalFeatures: [],
          houseRules: { optionalClassFeatures: true },
          levels: Array.from({ length: level }, (_, index) => ({
            class: { name: ref.className, source: ref.classSource },
            ...(index === 2 ? { subclass: { name, source } } : {}),
          })),
        }).some((held) => held.usesKey === classFeatureUsesKey(ref));
      expect(heldAt(Math.max(ref.level, 3)), `${ref.name} is not held`).toBe(true);
      if (ref.level > 3) expect(heldAt(ref.level - 1), `${ref.name} is held early`).toBe(false);
    }
  });
});

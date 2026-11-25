import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "./definition.ts";
import { featureLimitedUses } from "./featureLimitedUses.ts";
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

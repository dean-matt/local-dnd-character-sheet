import type { CharacterDefinition, FeatureKey } from "@dnd/character";
import { describe, expect, it } from "vitest";
import { withFeatureChoice, withFeaturePicks } from "./featureChoices.ts";

const expertise: FeatureKey = {
  name: "Expertise",
  source: "PHB",
  className: "Rogue",
  classSource: "PHB",
  level: 1,
};
type Choices = CharacterDefinition["featureChoices"];

describe("withFeaturePicks", () => {
  it("adds a feature's picks, and replaces them on the next change", () => {
    const first = withFeaturePicks([], expertise, () => ({ expertise: ["stealth"] }));
    expect(first).toEqual([{ feature: expertise, options: [], picks: { expertise: ["stealth"] } }]);
    const next = withFeaturePicks(first, expertise, (picks) => ({
      expertise: [...(picks?.expertise ?? []), "deception"],
    }));
    expect(next[0]?.picks).toEqual({ expertise: ["stealth", "deception"] });
  });

  it("drops the choice once it holds neither an option nor a pick", () => {
    const held: Choices = [{ feature: expertise, options: [], picks: { skills: ["stealth"] } }];
    expect(withFeaturePicks(held, expertise, () => ({}))).toEqual([]);
  });

  it("keeps another feature's choice, and the options beside its own picks", () => {
    const spirit: FeatureKey = { ...expertise, name: "Totem Spirit" };
    const bear = { name: "Bear", source: "PHB" };
    const held = withFeatureChoice([], spirit, [bear]);
    const next = withFeaturePicks(held, expertise, () => ({ skills: ["stealth"] }));
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual({ feature: spirit, options: [bear] });
  });
});

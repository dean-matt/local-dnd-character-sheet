import { type CharacterDefinition, displayName } from "@dnd/character";
import { describe, expect, it } from "vitest";
import { characterRecord } from "../test/records.ts";
import { levelChoiceRefusals, withoutLevelChoices } from "./levelChoices.ts";

const PHB = (name: string) => ({ name, source: "PHB" });
const FIGHTER = PHB("Fighter");
const CHAMPION = PHB("Champion");
const choice = (name: string, level: number) => ({
  feature: { ...PHB(name), className: "Fighter", classSource: "PHB", level },
  options: [PHB(`${name} option`)],
});

const definition = (edit: Partial<CharacterDefinition>): CharacterDefinition => ({
  ...characterRecord("1", "Vex").definition,
  ...edit,
});

const fighter = (count: number, subclassAt = 0) =>
  Array.from({ length: count }, (_, index) =>
    index + 1 === subclassAt ? { class: FIGHTER, subclass: CHAMPION } : { class: FIGHTER },
  );

describe("withoutLevelChoices", () => {
  it("takes what a middle level picked and keeps what the levels either side picked", () => {
    const spell = (name: string, pickedAt: number) => ({
      ref: PHB(name),
      prepared: false,
      pickedAt,
    });
    const before = definition({
      levels: fighter(3),
      featureChoices: [choice("Fighting Style", 1), choice("Action Surge", 2), choice("Late", 3)],
      spells: [spell("Shield", 1), spell("Misty Step", 2), spell("Fireball", 3)],
    });

    const after = withoutLevelChoices(before, 2);

    expect(after.levels).toEqual(fighter(1));
    expect(after.featureChoices).toEqual([choice("Fighting Style", 1), choice("Late", 3)]);
    expect(after.spells.map((each) => displayName(each.ref))).toEqual(["Shield", "Fireball"]);
  });
});

describe("levelChoiceRefusals", () => {
  it("names the later levels a changed subclass is built on, and allows it on the newest", () => {
    const before = definition({ levels: fighter(5, 3) });
    const changed = (levels: number) => definition({ levels: fighter(levels) });

    expect(levelChoiceRefusals(before, changed(5), 3)).toEqual([
      "Levels 4 and 5 build on Champion; remove them to change the subclass.",
    ]);
    const newest = definition({ levels: fighter(3, 3) });
    expect(levelChoiceRefusals(newest, changed(3), 3)).toEqual([]);
  });

  it("names a pick made for a feat the level no longer takes", () => {
    const initiate = {
      ref: PHB("Magic Initiate"),
      grantedBy: { kind: "class", ref: FIGHTER },
      level: 2,
    };
    const pick = {
      ref: PHB("Fire Bolt"),
      prepared: false,
      pickedFor: { kind: "feat", ref: PHB("Magic Initiate") },
    };
    const before = definition({
      levels: fighter(2),
      feats: [initiate] as CharacterDefinition["feats"],
      spells: [pick] as CharacterDefinition["spells"],
    });
    const after = { ...before, feats: [] };

    expect(levelChoiceRefusals(before, after, 2)).toEqual([
      "Fire Bolt was picked for Magic Initiate; remove it to drop Magic Initiate.",
    ]);
  });
});

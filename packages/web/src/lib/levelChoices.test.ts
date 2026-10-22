import type { FeatRecord } from "@dnd/catalog";
import { type CharacterDefinition, displayName, entryKey } from "@dnd/character";
import { describe, expect, it } from "vitest";
import { characterRecord } from "../test/records.ts";
import {
  levelChoiceDepartures,
  levelChoiceRefusals,
  type PrerequisiteRows,
  withoutLevelChoices,
} from "./levelChoices.ts";

const PHB = (name: string) => ({ name, source: "PHB" });
const NO_ROWS: PrerequisiteRows = { options: new Map(), feats: [] };
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

    expect(levelChoiceRefusals(before, changed(5), 3, NO_ROWS)).toEqual([
      "Levels 4 and 5 build on Champion; remove them to change the subclass.",
    ]);
    const newest = definition({ levels: fighter(3, 3) });
    expect(levelChoiceRefusals(newest, changed(3), 3, NO_ROWS)).toEqual([]);
  });

  it("names the later levels in the old or new starting class, and allows the rest", () => {
    const WIZARD = PHB("Wizard");
    const ROGUE = PHB("Rogue");
    const started = (cls: typeof FIGHTER, ...later: (typeof FIGHTER)[]) =>
      definition({ levels: [cls, ...later].map((each) => ({ class: each })) });

    expect(
      levelChoiceRefusals(
        started(FIGHTER, FIGHTER, WIZARD),
        started(WIZARD, FIGHTER, WIZARD),
        1,
        NO_ROWS,
      ),
    ).toEqual(["Levels 2 and 3 take Fighter or Wizard; remove them to change the starting class."]);
    expect(
      levelChoiceRefusals(started(FIGHTER, ROGUE), started(WIZARD, ROGUE), 1, NO_ROWS),
    ).toEqual([]);
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

    expect(levelChoiceRefusals(before, after, 2, NO_ROWS)).toEqual([
      "Fire Bolt was picked for Magic Initiate; remove it to drop Magic Initiate.",
    ]);
  });

  it("names a later option whose prerequisite the changed pick met", () => {
    const pick = (name: string, level: number) => ({
      ref: PHB(name),
      featureType: name.startsWith("Pact") ? "PB" : "EI",
      grantedBy: { kind: "class" as const, ref: PHB("Warlock") },
      level,
    });
    const secrets = pick("Book of Ancient Secrets", 5);
    const before = definition({
      levels: Array.from({ length: 5 }, () => ({ class: PHB("Warlock") })),
      optionalFeatures: [pick("Pact of the Tome", 3), secrets],
    });
    const after = { ...before, optionalFeatures: [pick("Pact of the Chain", 3), secrets] };
    const rows = {
      ...NO_ROWS,
      options: new Map([
        [entryKey(secrets.ref), [{ pact: "Tome", spells: [], options: [], unjudged: [] }]],
      ]),
    };

    expect(levelChoiceRefusals(before, after, 3, rows)).toEqual([
      "Book of Ancient Secrets, picked at level 5, needs Pact of the Tome; remove it to make this change.",
    ]);
    expect(levelChoiceRefusals(before, before, 3, rows)).toEqual([]);
  });

  it("names a later feat whose ability prerequisite the changed improvement met", () => {
    const ritualCaster = {
      ...PHB("Ritual Caster"),
      edition: "classic",
      json: { ...PHB("Ritual Caster"), prerequisite: [{ ability: [{ int: 13 }, { wis: 13 }] }] },
    } as FeatRecord;
    const increase = (ability: "int" | "str") => ({
      ability,
      amount: 2,
      grantedBy: "class" as const,
      level: 4,
    });
    const before = definition({
      levels: fighter(8),
      abilityScores: { str: 8, dex: 16, con: 14, int: 11, wis: 12, cha: 10 },
      abilityIncreases: [increase("int")],
      feats: [
        { ref: PHB("Ritual Caster"), grantedBy: { kind: "class", ref: FIGHTER }, level: 8 },
      ] as CharacterDefinition["feats"],
    });
    const after = { ...before, abilityIncreases: [increase("str")] };
    const rows = { ...NO_ROWS, feats: [ritualCaster] };

    expect(levelChoiceRefusals(before, after, 4, rows)).toEqual([
      "Ritual Caster, taken at level 8, needs Intelligence 13 or Wisdom 13; remove it to make this change.",
    ]);
    expect(levelChoiceRefusals(before, before, 4, rows)).toEqual([]);
  });
});

describe("levelChoiceDepartures", () => {
  it("notes a multiclass prerequisite a lowered improvement leaves unmet, without refusing", () => {
    const increase = (ability: "int" | "str") => ({
      ability,
      amount: 2,
      grantedBy: "class" as const,
      level: 4,
    });
    const before = definition({
      levels: [...fighter(4), { class: PHB("Wizard") }],
      abilityScores: { str: 13, dex: 16, con: 14, int: 11, wis: 12, cha: 10 },
      abilityIncreases: [increase("int")],
    });
    const after = { ...before, abilityIncreases: [increase("str")] };
    const classes = [
      { name: "Fighter", firstIndex: 0, prerequisite: [{ str: 13 }, { dex: 13 }] },
      { name: "Wizard", firstIndex: 4, prerequisite: [{ int: 13 }] },
    ];
    const note = "Multiclassing in or out of Wizard needs Intelligence 13.";

    expect(levelChoiceDepartures(before, after, classes)).toEqual({
      departures: [{ field: "levels.4.class", note }],
      added: [note],
    });
    expect(levelChoiceDepartures(before, before, classes).departures).toEqual([]);
    expect(levelChoiceRefusals(before, after, 4, NO_ROWS)).toEqual([]);
  });
});

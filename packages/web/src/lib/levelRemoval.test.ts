import type { CharacterDefinition } from "@dnd/character";
import { describe, expect, it } from "vitest";
import { characterRecord } from "../test/records.ts";
import { withoutLevelsFrom, withoutNewestLevel } from "./levelRemoval.ts";

const PHB = (name: string) => ({ name, source: "PHB" });
const FIGHTER = PHB("Fighter");
const WIZARD = PHB("Wizard");
const CHAMPION = PHB("Champion");
const choice = (name: string, level: number, subclass = false) => ({
  feature: {
    ...PHB(name),
    className: "Fighter",
    classSource: "PHB",
    ...(subclass && { subclass: { shortName: "Champion", source: "PHB" } }),
    level,
  },
  options: [PHB(`${name} option`)],
});

const definition = (edit: Partial<CharacterDefinition>): CharacterDefinition => ({
  ...characterRecord("1", "Vex").definition,
  ...edit,
});

describe("withoutNewestLevel", () => {
  it("takes the choices of every subclass level a level choosing the subclass brought", () => {
    const kept = [choice("Fighting Style", 1), choice("Action Surge", 2)];
    const before = definition({
      levels: [{ class: FIGHTER }, { class: FIGHTER }, { class: FIGHTER, subclass: CHAMPION }],
      featureChoices: [
        ...kept,
        choice("Early Gift", 2, true),
        choice("Improved Critical", 3, true),
      ],
    });

    const after = withoutNewestLevel(before);

    expect(after.levels).toEqual([{ class: FIGHTER }, { class: FIGHTER }]);
    expect(after.featureChoices).toEqual(kept);
  });

  it("takes only the subclass level reached where the subclass was chosen earlier", () => {
    const early = choice("Improved Critical", 3, true);
    const before = definition({
      levels: [
        { class: FIGHTER },
        { class: FIGHTER },
        { class: FIGHTER, subclass: CHAMPION },
        { class: FIGHTER },
      ],
      featureChoices: [early, choice("Late Gift", 4, true)],
    });

    expect(withoutNewestLevel(before).featureChoices).toEqual([early]);
  });

  it("keeps a pick no level-up stamped and what an earlier level brought", () => {
    const spells = [
      { ref: PHB("Shield"), prepared: false },
      { ref: PHB("Fire Bolt"), prepared: false, pickedAt: 1 },
    ];
    const feats = [{ ref: PHB("Alert"), grantedBy: { kind: "class", ref: FIGHTER }, level: 1 }];
    const before = definition({
      levels: [{ class: FIGHTER }, { class: FIGHTER }],
      spells: [...spells, { ref: PHB("Misty Step"), prepared: false, pickedAt: 2 }],
      feats: [
        ...feats,
        { ref: PHB("Lucky"), grantedBy: { kind: "class", ref: FIGHTER }, level: 2 },
      ] as CharacterDefinition["feats"],
      experience: 300,
    });

    const after = withoutNewestLevel(before);

    expect(after.spells).toEqual(spells);
    expect(after.feats).toEqual(feats);
    expect(after.experience).toBe(300);
  });

  it("takes the picks made for a feat or an option the level took, unless another copy stays", () => {
    const adept = PHB("Martial Adept");
    const style = PHB("Superior Technique");
    const byFeat = { kind: "feat", ref: adept } as const;
    const byStyle = { kind: "optionalFeature", ref: style } as const;
    const fighter = { kind: "class", ref: FIGHTER } as const;
    const maneuver = (
      name: string,
      grantedBy: CharacterDefinition["optionalFeatures"][number]["grantedBy"],
    ) => ({
      ref: PHB(name),
      featureType: "MV:B",
      grantedBy,
    });
    const keptPicks = [maneuver("Parry", { kind: "feat", ref: PHB("Alert") })];
    const before = definition({
      levels: [{ class: FIGHTER }, { class: FIGHTER }],
      feats: [{ ref: adept, grantedBy: fighter, level: 2 }],
      optionalFeatures: [
        ...keptPicks,
        { ref: style, featureType: "FS:F", grantedBy: fighter, level: 2 },
        maneuver("Riposte", byFeat),
        maneuver("Feint", byStyle),
      ],
      spells: [{ ref: PHB("Light"), prepared: false, pickedFor: byFeat }],
    });

    const after = withoutNewestLevel(before);

    expect(after.optionalFeatures).toEqual(keptPicks);
    expect(after.spells).toEqual([]);

    const twice = definition({
      ...before,
      feats: [{ ref: adept, grantedBy: fighter, level: 1 }, ...before.feats],
    });
    expect(withoutNewestLevel(twice).optionalFeatures).toContainEqual(maneuver("Riposte", byFeat));
  });

  it("drops the level's own departures, and every prerequisite note once one class is left", () => {
    const gain = { field: "levels.1.rolled", note: "Level 2 gains 12 hit points." };
    const before = definition({
      levels: [{ class: FIGHTER }, { class: FIGHTER, rolled: 12, typed: true }, { class: WIZARD }],
      departures: [
        gain,
        { field: "levels.0.class", note: "Multiclassing in or out of Fighter needs Strength 13." },
        {
          field: "levels.2.class",
          note: "Multiclassing in or out of Wizard needs Intelligence 13.",
        },
        { field: "levels.2.rolled", note: "Level 3 gains 9 hit points." },
        { field: "race", note: "Kept." },
      ],
    });

    expect(withoutNewestLevel(before).departures).toEqual([gain, { field: "race", note: "Kept." }]);
  });

  it("leaves a character of one level as it is", () => {
    const before = definition({ levels: [{ class: FIGHTER }] });

    expect(withoutNewestLevel(before)).toBe(before);
  });
});

describe("withoutLevelsFrom", () => {
  it("takes the level and every level after it, with what each brought", () => {
    const before = definition({
      levels: [{ class: FIGHTER }, { class: FIGHTER }, { class: FIGHTER, subclass: CHAMPION }],
      featureChoices: [choice("Fighting Style", 1), choice("Action Surge", 2)],
    });

    expect(withoutLevelsFrom(before, 2)).toEqual(
      definition({ levels: [{ class: FIGHTER }], featureChoices: [choice("Fighting Style", 1)] }),
    );
  });

  it("keeps level 1, which a character cannot be without", () => {
    const before = definition({ levels: [{ class: FIGHTER }, { class: WIZARD }] });

    expect(withoutLevelsFrom(before, 1).levels).toEqual([{ class: FIGHTER }]);
  });
});

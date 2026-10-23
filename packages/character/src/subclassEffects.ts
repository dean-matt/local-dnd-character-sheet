import { ABILITY_LABEL, type Term } from "@dnd/rules";
import type { CharacterDefinition } from "./definition.ts";
import type { TermReference } from "./derivedField.ts";
import { refKey } from "./keys.ts";
import type { Ability, ContentRef } from "./refs.ts";
import { classLevels } from "./summaries.ts";

type InitiativeBonus = {
  feature: ContentRef;
  addend: Ability | "proficiency";
  level: number;
};

/**
 * Initiative bonuses a subclass feature states only in prose. Keys are the class row and
 * the `subclasses` row a level stores, as `unarmoredDefense.ts` keys its formulas; the
 * 2014 and 2024 rows of a class share a subclass printed once. Left out: Avatar of Battle
 * (UA Mystic, allies only), Tandem Footwork (XPHB Bard, a Bardic Inspiration die that
 * helps allies) and Adventurer's Atlas (EFA Artificer, a target's bonus).
 */
const SUBCLASS_INITIATIVE = new Map<string, InitiativeBonus>();

function register(
  classes: string[],
  subclass: string,
  feature: ContentRef,
  addend: InitiativeBonus["addend"],
  level: number,
): void {
  for (const klass of classes)
    SUBCLASS_INITIATIVE.set(`${klass}|${subclass}`, { feature, addend, level });
}

register(
  ["Rogue|PHB", "Rogue|XPHB"],
  "Swashbuckler|XGE",
  { name: "Rakish Audacity", source: "XGE" },
  "cha",
  3,
);
register(
  ["Ranger|PHB", "Ranger|XPHB"],
  "Gloom Stalker|XGE",
  { name: "Dread Ambusher", source: "XGE" },
  "wis",
  3,
);
register(
  ["Ranger|XPHB"],
  "Gloom Stalker|XPHB",
  { name: "Dread Ambusher", source: "XPHB" },
  "wis",
  3,
);
register(
  ["Wizard|PHB", "Wizard|XPHB"],
  "Chronurgy Magic|EGW",
  { name: "Temporal Awareness", source: "EGW" },
  "int",
  2,
);
register(
  ["Wizard|PHB", "Wizard|XPHB"],
  "War Magic|XGE",
  { name: "Tactical Wit", source: "XGE" },
  "int",
  2,
);
register(
  ["Paladin|PHB", "Paladin|XPHB"],
  "Oath of the Watchers|TCE",
  { name: "Aura of the Sentinel", source: "TCE" },
  "proficiency",
  7,
);

export function subclassInitiativeTerms(
  definition: CharacterDefinition,
  modifierOf: (ability: Ability) => number,
  proficiencyBonus: number,
): Term<TermReference>[] {
  return classLevels(definition).flatMap((group) => {
    if ("homebrewId" in group.class || !group.subclass) return [];
    const bonus = SUBCLASS_INITIATIVE.get(`${refKey(group.class)}|${refKey(group.subclass)}`);
    if (!bonus || group.level < bonus.level) return [];
    const value = bonus.addend === "proficiency" ? proficiencyBonus : modifierOf(bonus.addend);
    const label =
      bonus.addend === "proficiency"
        ? bonus.feature.name
        : `${bonus.feature.name} (${ABILITY_LABEL[bonus.addend]})`;
    return [{ label, value, reference: bonus.feature }];
  });
}

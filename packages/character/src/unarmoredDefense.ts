import { ABILITY_LABEL, type Term } from "@dnd/rules";
import type { CharacterDefinition } from "./definition.ts";
import type { TermReference } from "./derivedField.ts";
import { refKey } from "./keys.ts";
import type { Ability, ContentRef } from "./refs.ts";
import { classLevels } from "./summaries.ts";

/**
 * What a feature adds to the unarmored base of 10: an ability modifier, or a flat 3 for the
 * 2014 Draconic Resilience, whose printed "13 + Dexterity" is the same sum.
 */
type Formula = {
  feature: string;
  addend: { ability: Ability } | { flat: number };
  /** Whether wielding a shield leaves the formula standing. */
  shield: "keeps" | "removes";
  /** The class level the feature arrives at. */
  level: number;
};

/**
 * 5etools states each formula only as prose, so this table is the one place they live.
 * Classes key on the class row and subclasses on the `subclasses` row a level stores,
 * `Draconic Bloodline` rather than the `Draconic` its features carry. A homebrew class
 * is absent by design: its formula is the author's to state.
 */
const CLASS_FORMULAS = new Map<string, Formula>([
  ["Barbarian|PHB", unarmored("con", "keeps", 1)],
  ["Barbarian|XPHB", unarmored("con", "keeps", 1)],
  ["Monk|PHB", unarmored("wis", "removes", 1)],
  ["Monk|XPHB", unarmored("wis", "removes", 1)],
]);

const SUBCLASS_FORMULAS = new Map<string, Formula>([
  ["Sorcerer|PHB|Draconic Bloodline|PHB", draconic({ flat: 3 }, 1)],
  ["Sorcerer|XPHB|Draconic Sorcery|XPHB", draconic({ ability: "cha" }, 3)],
  ["Bard|XPHB|College of Dance|XPHB", unarmored("cha", "removes", 3)],
]);

function unarmored(ability: Ability, shield: Formula["shield"], level: number): Formula {
  return { feature: "Unarmored Defense", addend: { ability }, shield, level };
}

function draconic(addend: Formula["addend"], level: number): Formula {
  return { feature: "Draconic Resilience", addend, shield: "keeps", level };
}

/** Every formula the character's classes and subclasses have reached. */
function reachedFormulas(definition: CharacterDefinition): Formula[] {
  const reached: Formula[] = [];
  for (const group of classLevels(definition)) {
    if ("homebrewId" in group.class) continue;
    const classKey = refKey(group.class);
    const own = CLASS_FORMULAS.get(classKey);
    if (own && group.level >= own.level) reached.push(own);
    const chosen = group.subclass as ContentRef | undefined;
    const subclass = chosen && SUBCLASS_FORMULAS.get(`${classKey}|${refKey(chosen)}`);
    if (subclass && group.level >= subclass.level) reached.push(subclass);
  }
  return reached;
}

/**
 * The unarmored base the character's best formula gives, as the term that adds to the 10
 * in place of armor. A formula that adds nothing, or loses to another, yields none, so a
 * negative modifier never lowers the plain 10.
 */
export function unarmoredDefenseTerm(
  definition: CharacterDefinition,
  modifierOf: (ability: Ability) => number,
  shielded: boolean,
): Term<TermReference> | undefined {
  let best: Term<TermReference> | undefined;
  for (const formula of reachedFormulas(definition)) {
    if (shielded && formula.shield === "removes") continue;
    const { addend } = formula;
    const value = "flat" in addend ? addend.flat : modifierOf(addend.ability);
    if (value <= (best?.value ?? 0)) continue;
    const label =
      "ability" in addend
        ? `${formula.feature} (${ABILITY_LABEL[addend.ability]})`
        : formula.feature;
    best = { label, value };
  }
  return best;
}

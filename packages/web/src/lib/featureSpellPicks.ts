import {
  type ClassFeatureGrantor,
  classFeatureGrantor,
  type FeatureKey,
  featureSpellPicks,
  type SpellPick,
} from "@dnd/character";
import type { PickGrantor } from "./spellGrantors.ts";
import { type PickedSpell, pickKey } from "./spellPicks.ts";

/** One pick a held class or subclass feature leaves to the player, and the spells made for it. */
export type FeaturePickRow = {
  feature: FeatureKey;
  pickedFor: ClassFeatureGrantor;
  pick: SpellPick;
  picked: PickedSpell[];
};

/**
 * Each pick the held class and subclass features leave to the player, in the order the
 * features list them. A spell picked for a feature counts against the pick of its own level,
 * or the pick that names none.
 */
export function featurePickRows(
  definition: Parameters<typeof featureSpellPicks>[0],
  picked: readonly PickedSpell[],
): FeaturePickRow[] {
  return featureSpellPicks(definition).flatMap(({ feature, picks }) => {
    const pickedFor = classFeatureGrantor(feature);
    const made = picked.filter(
      (spell) => spell.pickedFor && pickKey(spell.pickedFor) === pickKey(pickedFor),
    );
    return picks.map((pick) => ({
      feature,
      pickedFor,
      pick,
      picked: made.filter((spell) => pick.level === undefined || spell.level === pick.level),
    }));
  });
}

/** Whether `row` still owes a pick. */
export const owesPick = ({ pick, picked }: FeaturePickRow) => picked.length < pick.count;

/**
 * Whether a spell picked for `pickedFor` is one its feature grants, as Magical Secrets and
 * Mystic Arcanum do, rather than a mark on a spell the character already holds, as Spell
 * Mastery and Signature Spells do.
 */
export function grantedByFeature(
  definition: Parameters<typeof featureSpellPicks>[0],
  pickedFor: PickGrantor | undefined,
): boolean {
  if (pickedFor?.kind !== "classFeature") return false;
  const key = pickKey(pickedFor);
  return featureSpellPicks(definition).some(
    ({ feature, picks }) =>
      pickKey(classFeatureGrantor(feature)) === key && picks.some(({ from }) => from !== "book"),
  );
}

import {
  type ClassFeatureGrantor,
  classFeatureGrantor,
  type FeatureKey,
  featureSpellPicks,
  type SpellPick,
} from "@dnd/character";
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

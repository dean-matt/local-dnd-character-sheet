/**
 * The initiative, hit point and speed bonuses a feature states only in its prose. 5etools
 * carries no field for them, so the sheet reads them from the recorded feature mechanics,
 * and a feature they do not name adds nothing.
 */
import type { Term } from "@dnd/rules";
import type { Speed } from "./characterDerived.ts";
import type { TermReference } from "./derivedField.ts";
import { type Mechanic, mechanicsOfKind } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import type { ContentRef } from "./refs.ts";

type FeatBonus = {
  initiative?: number | "proficiency";
  hitPointsPerLevel?: number;
  walk?: number;
};

/** What a held feature bonuses; `levels` scales a per-level bonus. */
function bonusFeats(
  definition: HoldsFeatures,
): { ref: ContentRef; bonus: FeatBonus; levels: number }[] {
  return heldFeatures(definition).map(({ ref, entry, levels }) => ({
    ref,
    levels,
    bonus: Object.fromEntries(
      mechanicsOfKind(entry, "bonus").map(({ target, value }) => [target, value]),
    ) as FeatBonus,
  }));
}

export function featInitiativeTerms(
  definition: HoldsFeatures,
  proficiencyBonus: number,
): Term<TermReference>[] {
  return bonusFeats(definition).flatMap(({ ref, bonus: { initiative } }) =>
    initiative === undefined
      ? []
      : [
          {
            label: ref.name,
            value: initiative === "proficiency" ? proficiencyBonus : initiative,
            reference: ref,
          },
        ],
  );
}

/** Whether a held feature already adds the proficiency bonus to initiative, which half proficiency does not stack on. */
export const initiativeUsesProficiency = (definition: HoldsFeatures): boolean =>
  bonusFeats(definition).some(({ bonus }) => bonus.initiative === "proficiency");

export function featHitPointTerms(definition: HoldsFeatures): Term<TermReference>[] {
  return bonusFeats(definition).flatMap(({ ref, levels, bonus: { hitPointsPerLevel } }) =>
    hitPointsPerLevel === undefined
      ? []
      : [{ label: ref.name, value: hitPointsPerLevel * levels, reference: ref }],
  );
}

type SpeedMode = "walk" | "climb" | "swim";
type SpeedMechanic = Extract<Mechanic, { kind: "speed" }>;

function applySpeedMechanic(
  speed: Speed & { walk: number },
  mechanic: SpeedMechanic,
  ref: ContentRef,
): Term<TermReference>[] {
  const name = mechanic.label ?? ref.name;
  const terms: Term<TermReference>[] = [];
  const raise = (mode: SpeedMode, to: number) => {
    const from = speed[mode] ?? 0;
    terms.push({ label: `${name}: ${mode} ${from} to ${to}`, value: to - from, reference: ref });
    speed[mode] = to;
  };
  raise("walk", speed.walk + mechanic.bonus);
  for (const mode of mechanic.alsoOn ?? [])
    if (speed[mode]) raise(mode, speed[mode] + mechanic.bonus);
  for (const mode of mechanic.equalToWalk ?? [])
    if ((speed[mode] ?? 0) < speed.walk) raise(mode, speed.walk);
  return terms;
}

/**
 * Applied to the race's speed, so an item that sets or scales a speed reads the raised walk.
 * Roving sets a climbing or swimming speed to the walk it just raised, and nothing later
 * keeps them level.
 */
export function speedWithFeats(
  base: Speed,
  definition: HoldsFeatures,
  heavyArmorWorn: boolean,
): { speed: Speed; terms: Term<TermReference>[] } {
  if (base.walk === undefined) return { speed: base, terms: [] };
  const speed = { ...base, walk: base.walk };
  const terms: Term<TermReference>[] = [];
  for (const { ref, bonus } of bonusFeats(definition)) {
    if (bonus.walk === undefined) continue;
    terms.push({
      label: `${ref.name}: walk ${speed.walk} to ${speed.walk + bonus.walk}`,
      value: bonus.walk,
      reference: ref,
    });
    speed.walk += bonus.walk;
  }
  for (const { ref, entry } of heldFeatures(definition))
    for (const mechanic of mechanicsOfKind(entry, "speed"))
      if (!(mechanic.unlessHeavyArmor && heavyArmorWorn))
        terms.push(...applySpeedMechanic(speed, mechanic, ref));
  return { speed, terms };
}

import {
  type CharacterDerived,
  type CharacterState,
  type ContentRef,
  spellCastOptions,
} from "@dnd/character";

/** What the player chooses for an amount per choice: the slot level or the creatures, among `values`. */
export type RestoreChoice = {
  unit: "slotLevel" | "creature";
  values: number[];
};

/**
 * The choice a use of `feature` asks for, or null where none of its restores lands per choice. A
 * pact slot is not offered, so a slot level is one the sheet's spell slots still hold.
 */
export function restoreChoice(
  derived: CharacterDerived,
  state: CharacterState,
  feature: ContentRef,
): RestoreChoice | null {
  const per = derived.featureRestores.find(
    (restore) =>
      restore.per &&
      restore.feature.name === feature.name &&
      restore.feature.source === feature.source,
  )?.per;
  if (!per) return null;
  if (per.unit === "slotLevel") {
    const values = spellCastOptions({ level: 1, ritual: false }, derived, state)
      .filter(({ via, left }) => via === "slot" && left !== null && left > 0)
      .map(({ level }) => level);
    return { unit: per.unit, values };
  }
  return { unit: per.unit, values: Array.from({ length: per.most ?? 1 }, (_, index) => index + 1) };
}

/** The value the player picked while it is still offered, else the first offered, else 1. */
export const chosenValue = (choice: RestoreChoice | null, picked: number | null) =>
  choice === null
    ? 1
    : picked !== null && choice.values.includes(picked)
      ? picked
      : (choice.values[0] ?? 1);

/** Why the use is refused: the choice offers no value, which only a slot level can lack. */
export const choiceBlocked = (choice: RestoreChoice | null) =>
  choice?.values.length === 0 ? "No spell slot left." : null;

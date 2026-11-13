import { concentrationSaveDc } from "@dnd/rules";
import type { CharacterDerived } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import { derivedValue } from "./resolve.ts";
import type { CharacterState, Concentration } from "./state.ts";

/**
 * The state holding `concentration`, and the concentration that ended to make room, or null
 * where none was held. Starting never refuses: a caster may drop one spell for another.
 */
export const concentrationStarted = (
  state: CharacterState,
  concentration: Pick<Concentration, "spell" | "level">,
) => ({
  state: {
    ...state,
    concentration: {
      ...concentration,
      ...(state.encounter && { round: state.encounter.round }),
    },
  },
  ended: state.concentration,
});

/**
 * The rounds an encounter has run since concentration began, or null where none is held or
 * no encounter is running. A spell held from before the encounter counts from its round 1.
 */
export function concentrationRounds(state: CharacterState): number | null {
  if (!state.concentration || !state.encounter) return null;
  return state.encounter.round - (state.concentration.round ?? 1);
}

/** The state with no concentration held and nothing else changed, whatever broke it. */
export const concentrationEnded = (state: CharacterState): CharacterState => ({
  ...state,
  concentration: null,
});

/** The conditions that incapacitate under both editions, Incapacitated among them, lowercased. */
const INCAPACITATING = new Set([
  "incapacitated",
  "paralyzed",
  "petrified",
  "stunned",
  "unconscious",
]);

/**
 * The state with concentration ended where its character can no longer hold it, at 0 hit points
 * or under a condition that incapacitates, catalog or custom, else the state as given.
 */
export function concentrationLapsed(state: CharacterState): CharacterState {
  const held = [...state.conditions.map(({ name }) => name), ...state.customConditions];
  const incapacitated = held.some((name) => INCAPACITATING.has(name.toLowerCase()));
  return state.concentration && (state.hitPoints.current === 0 || incapacitated)
    ? concentrationEnded(state)
    : state;
}

/**
 * The Constitution save `damage` taken calls for: its DC by `concentrationSaveDc` under the
 * definition's edition, and the save the sheet shows, the concentration save where an item
 * adds to it, else the Constitution save.
 */
export function concentrationCheck(
  definition: Pick<CharacterDefinition, "edition">,
  derived: Pick<CharacterDerived, "concentrationSave" | "savingThrows">,
  damage: number,
): { dc: number; save: number } {
  return {
    dc: concentrationSaveDc(damage, definition.edition),
    save: derivedValue(derived.concentrationSave ?? derived.savingThrows.con),
  };
}

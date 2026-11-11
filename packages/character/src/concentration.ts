import { concentrationSaveDc } from "@dnd/rules";
import type { CharacterDerived } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import { derivedValue } from "./resolve.ts";
import type { CharacterState, Concentration } from "./state.ts";

/**
 * The state holding `concentration`, and the concentration that ended to make room, or null
 * where none was held. Starting never refuses: a caster may drop one spell for another.
 */
export const concentrationStarted = (state: CharacterState, concentration: Concentration) => ({
  state: { ...state, concentration },
  ended: state.concentration,
});

/** The state with no concentration held and nothing else changed, whatever broke it. */
export const concentrationEnded = (state: CharacterState): CharacterState => ({
  ...state,
  concentration: null,
});

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

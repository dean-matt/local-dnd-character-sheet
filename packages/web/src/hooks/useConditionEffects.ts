import { conditionRollEffects, type RollEffectEntry } from "@dnd/character";
import { useCharacterState } from "./useCharacterState.ts";

/** The advantage and disadvantage the character's conditions and exhaustion put on one kind of roll. */
export function useConditionEffects(
  characterId: string,
  edition: "classic" | "one",
  roll: "check" | "save" | "attack" | "initiative",
): RollEffectEntry[] {
  const state = useCharacterState(characterId).data?.state;
  return state ? conditionRollEffects(state, edition, roll) : [];
}

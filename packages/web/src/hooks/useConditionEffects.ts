import {
  type CharacterDefinition,
  conditionRollEffects,
  type RollEffectEntry,
} from "@dnd/character";
import { useCharacterState } from "./useCharacterState.ts";

/** The advantage and disadvantage the character's conditions and exhaustion put on one kind of roll. */
export function useConditionEffects(
  characterId: string,
  definition: Pick<CharacterDefinition, "edition" | "houseRules">,
  roll: "check" | "save" | "attack" | "initiative",
): RollEffectEntry[] {
  const state = useCharacterState(characterId).data?.state;
  return state ? conditionRollEffects(state, definition, roll) : [];
}

import { exhaustionRollEffects, type RollEffectEntry } from "@dnd/character";
import { useCharacterState } from "./useCharacterState.ts";

/** Classic exhaustion's disadvantage on one kind of roll, from the character's play state. */
export function useExhaustionEffects(
  characterId: string,
  edition: "classic" | "one",
  roll: "check" | "save",
): RollEffectEntry[] {
  const level = useCharacterState(characterId).data?.state.exhaustion ?? 0;
  return exhaustionRollEffects(level, edition, roll);
}

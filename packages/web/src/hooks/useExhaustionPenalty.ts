import { exhaustionRollPenalty } from "@dnd/character";
import type { RollPenalty } from "../lib/penalisedRoll.ts";
import { useCharacter } from "./useCharacter.ts";
import { useCharacterState } from "./useCharacterState.ts";

/** What 2024 exhaustion takes off a D20 Test, from the character's play state; absent for a classic one. */
export function useExhaustionPenalty(characterId: string): RollPenalty | undefined {
  const level = useCharacterState(characterId).data?.state.exhaustion ?? 0;
  const edition = useCharacter(characterId).data?.definition.edition;
  return edition === undefined ? undefined : exhaustionRollPenalty(level, edition);
}

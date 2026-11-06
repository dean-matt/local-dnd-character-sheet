import { useIsMutating } from "@tanstack/react-query";
import { characterDefinitionWriteKey, characterStateWriteKey } from "./characterKeys.ts";

/** Whether a write to the character's definition or state, an undo among them, is in flight. */
export function useCharacterWriting(id: string) {
  return (
    useIsMutating({ mutationKey: characterDefinitionWriteKey(id) }) +
      useIsMutating({ mutationKey: characterStateWriteKey(id) }) >
    0
  );
}

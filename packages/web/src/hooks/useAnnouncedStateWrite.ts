import type { CharacterState } from "@dnd/character";
import { useState } from "react";
import { useReplaceCharacterState } from "./useReplaceCharacterState.ts";

/**
 * A state write that announces `text` once it lands. `write` resolves `true` when the write
 * landed and `false` when it failed or another write was still in flight; the mutation's own
 * `error` names a failure. `announced` feeds an `Announcer`, and `announce` speaks without a
 * write.
 */
export function useAnnouncedStateWrite(id: string) {
  const replace = useReplaceCharacterState(id);
  const [announced, setAnnounced] = useState({ text: "", count: 0 });

  function announce(text: string) {
    setAnnounced(({ count }) => ({ text, count: count + 1 }));
  }

  async function write(after: CharacterState, text: string) {
    if (replace.writing) return false;
    try {
      await replace.mutateAsync(after);
    } catch {
      return false;
    }
    announce(text);
    return true;
  }

  return { ...replace, write, announce, announced };
}

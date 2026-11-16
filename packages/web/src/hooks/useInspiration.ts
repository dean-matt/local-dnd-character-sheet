import { inspirationEffect } from "@dnd/character";
import { useState } from "react";
import { useCharacter } from "./useCharacter.ts";
import { useCharacterState } from "./useCharacterState.ts";
import { useReplaceCharacterState } from "./useReplaceCharacterState.ts";

type Mode = "normal" | "advantage" | "disadvantage";

/**
 * The spending of inspiration on one d20 test, for a roll made in `mode` with `extraDie` typed.
 * Nothing is offered unless `enabled` and the character holds inspiration. Advantage nets
 * against a disadvantage to normal; a reroll is of a single d20 in the normal mode, so it is
 * `blocked` by a mode or a named die, and advantage is `blocked` when the roll already has it. `spend` clears the inspiration in one state write and
 * resolves whether it landed.
 */
export function useInspiration(
  characterId: string,
  enabled: boolean,
  mode: Mode,
  extraDie: string,
) {
  const target = enabled ? characterId : "";
  const held = useCharacterState(target).data?.state;
  const definition = useCharacter(target).data?.definition;
  const replace = useReplaceCharacterState(target);
  const [chosen, setChosen] = useState(false);

  const effect = definition && inspirationEffect(definition.edition, definition.houseRules);
  const offered = held?.inspiration === true && effect !== undefined;
  const blocked =
    effect === "reroll"
      ? mode !== "normal" || extraDie.trim() !== ""
      : effect === "advantage" && mode === "advantage";
  if (blocked && chosen) setChosen(false);
  const spending = offered && chosen && !blocked;
  const toggleable = !blocked && !replace.writing;

  return {
    offered,
    effect,
    blocked,
    spending,
    toggleable,
    toggle: () => toggleable && setChosen(!chosen),
    mode: spending && effect === "advantage" ? netWithAdvantage(mode) : mode,
    d20: spending && effect === "reroll" ? ({ reason: "lucky", kept: 1 } as const) : undefined,
    spend: async () => {
      if (!held) return false;
      try {
        await replace.mutateAsync({ ...held, inspiration: false });
      } catch {
        return false;
      }
      setChosen(false);
      return true;
    },
  };
}

function netWithAdvantage(mode: Mode): Mode {
  return mode === "disadvantage" ? "normal" : "advantage";
}

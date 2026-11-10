import type { RollType } from "@dnd/character";
import { useContext } from "react";
import { useRollAndRecord } from "../../../hooks/useRollAndRecord.ts";
import { RollingSpell } from "../../rollerContext.ts";

/** What each roll tag rolls. `{@dice}`, `{@d20}` and `{@scaledice}` do not say. */
const TAG_TYPE: Readonly<Record<string, RollType>> = {
  hit: "attack",
  damage: "damage",
  scaledamage: "damage",
  savingThrow: "save",
  skillCheck: "check",
};

const SPELL_TAG_TYPE: Readonly<Record<string, RollType>> = {
  ...TAG_TYPE,
  hit: "spell-attack",
  damage: "spell-damage",
  scaledamage: "spell-damage",
};

/**
 * Rolls its notation and records the roll, typed by its tag and by whether a spell's own text
 * holds it; the character layout shows it in the roll log. The status region exists before the
 * first roll so a reader speaks the one failure that has no entry to show: a roll that could
 * not be recorded.
 */
export function RollButton({
  characterId,
  tag,
  notation,
  display,
}: {
  characterId: string;
  tag: string;
  notation: string;
  display: string;
}) {
  const { roll, failed } = useRollAndRecord(characterId);
  const types = useContext(RollingSpell) ? SPELL_TAG_TYPE : TAG_TYPE;

  return (
    <span data-notation={notation} data-rollable="true">
      <button
        type="button"
        onClick={() => roll(notation, display, types[tag] ?? "dice")}
        aria-label={`Roll ${display}`}
        className="cursor-pointer underline decoration-dotted underline-offset-2"
      >
        {display}
      </button>
      <span role="status" className="text-error empty:hidden">
        {failed && " not logged"}
      </span>
    </span>
  );
}

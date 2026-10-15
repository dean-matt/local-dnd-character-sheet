import type { CharacterRecord } from "@dnd/character";
import { type AddOutcome, useAddToCharacter } from "../../hooks/useAddToCharacter.ts";
import type { Addable } from "../../lib/addable.ts";

/** One character in "Add to…"'s list, handing back the add for that character when chosen. */
export function AddToOption({
  character,
  onPick,
}: {
  character: CharacterRecord;
  onPick: (add: (row: Addable) => Promise<AddOutcome>) => void;
}) {
  const add = useAddToCharacter(character.id);
  return (
    <button
      type="button"
      onClick={() => onPick(add)}
      className="cursor-pointer truncate rounded-control px-1.5 py-1 text-left text-row text-ink hover:bg-subtle"
    >
      {character.name}
    </button>
  );
}

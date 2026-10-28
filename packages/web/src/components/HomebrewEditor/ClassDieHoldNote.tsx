import { HeldByNote } from "./HeldByNote.tsx";
import type { ClassDieHold } from "./useClassDieHold.ts";

/**
 * The info button beside Save on a draft that changes a stored class's hit die: why Save is
 * unavailable while characters hold the class, or that they could not be checked.
 */
export function ClassDieHoldNote({ hold: { name, hitDie, characters } }: { hold: ClassDieHold }) {
  return (
    <HeldByNote
      label={characters ? "Why Save is unavailable" : "Who holds this class"}
      holders={characters}
      message={`${name} is held by ${characters?.length === 1 ? "this character" : "these characters"}, so its hit die stays d${hitDie}. Keep d${hitDie}, or add a class with another name for the new die.`}
      failure={`Couldn't check which characters hold this class. If any do, Save fails and its hit die stays d${hitDie}.`}
    />
  );
}

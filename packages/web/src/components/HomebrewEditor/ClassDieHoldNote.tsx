import { HeldByNote } from "./HeldByNote.tsx";
import type { ClassDieHold } from "./useClassDieHold.ts";

/**
 * The info button beside Save on a draft that changes a stored class's hit die: why Save is
 * unavailable while characters hold the class, or while they could not be checked.
 */
export function ClassDieHoldNote({
  hold: { name, hitDie, characters, retry, checking },
}: {
  hold: ClassDieHold;
}) {
  return (
    <HeldByNote
      label="Why Save is unavailable"
      holders={characters}
      message={`${name} is held by ${characters?.length === 1 ? "this character" : "these characters"}, so its hit die stays d${hitDie}. Keep d${hitDie}, or add a class with another name for the new die.`}
      failure={
        <>
          <p>
            Couldn't check which characters hold this class, so Save waits until they are checked. A
            held class keeps its hit die, d{hitDie}.
          </p>
          <button
            type="button"
            aria-disabled={checking}
            onClick={() => !checking && retry()}
            className="mt-1 font-semibold text-accent-text underline aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          >
            {checking ? "Checking…" : "Retry"}
          </button>
        </>
      }
    />
  );
}

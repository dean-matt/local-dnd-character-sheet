import { HeldByNote } from "./HeldByNote.tsx";
import type { HeldSaveHold } from "./useHeldSaveHold.ts";

/**
 * The info button beside Save on a draft that changes what a stored row's holders rely on:
 * why Save is unavailable while characters hold the row, or while they could not be checked.
 */
export function HeldSaveHoldNote({
  hold: { name, noun, consequence, kept, characters, retry, checking },
}: {
  hold: HeldSaveHold;
}) {
  return (
    <HeldByNote
      label="Why Save is unavailable"
      holders={characters}
      message={`${name} is held by ${characters?.length === 1 ? "this character" : "these characters"}, ${consequence}`}
      failure={
        <>
          <p>
            Couldn't check which characters hold this {noun}, so Save waits until they are checked.
            A held {noun} keeps {kept}.
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

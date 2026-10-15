import type { AddOutcome } from "../hooks/useAddToCharacter.ts";

/**
 * What the last "Add to…" did, and any departure from the rules it noted. The live region
 * renders while empty, since one added along with its text is often not announced.
 */
export function AddedNotice({ outcome }: { outcome: AddOutcome | undefined }) {
  return (
    <div role="status" aria-label="Last addition">
      {outcome && (
        <div className="rounded-control border border-border bg-subtle px-3 py-2 text-row">
          <p className={`font-semibold ${outcome.failed ? "text-error" : "text-ink"}`}>
            {outcome.text}
          </p>
          {outcome.note && <p className="mt-0.5 text-secondary">{outcome.note}</p>}
        </div>
      )}
    </div>
  );
}

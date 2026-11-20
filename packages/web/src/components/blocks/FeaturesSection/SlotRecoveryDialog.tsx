import type { SlotRecoveryPick } from "@dnd/character";
import { useId, useState } from "react";
import { Modal } from "../../Modal.tsx";
import { ModalEntry } from "../../ModalEntry.tsx";

const PRIMARY =
  "min-h-11 rounded-control bg-accent px-3.5 font-semibold text-row text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:text-muted";

const SECONDARY =
  "min-h-11 rounded-control px-3.5 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:text-muted";

/**
 * The expended slots a feature recovers, a count picked for each level it can take against a
 * budget of combined slot levels. The caller applies the pick and closes the dialog once it lands.
 */
export function SlotRecoveryDialog({
  name,
  budget,
  slots,
  busy,
  error,
  onRecover,
  onClose,
}: {
  name: string;
  budget: number;
  slots: readonly { level: number; expended: number }[];
  busy: boolean;
  error: string | undefined;
  onRecover: (picks: SlotRecoveryPick[]) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [counts, setCounts] = useState<Record<number, number>>({});
  const picks = slots.map(({ level }) => ({ level, count: counts[level] ?? 0 }));
  const spent = picks.reduce((sum, { level, count }) => sum + level * count, 0);
  const ready = spent >= 1 && spent <= budget && !busy;

  return (
    <Modal onClose={() => !busy && onClose()} size="narrow">
      <ModalEntry
        title={name}
        meta="Spell slots"
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-disabled={busy}
              onClick={() => !busy && onClose()}
              className={SECONDARY}
            >
              Cancel
            </button>
            <button
              type="button"
              aria-disabled={!ready}
              onClick={() => ready && onRecover(picks.filter(({ count }) => count > 0))}
              className={PRIMARY}
            >
              Recover
            </button>
          </div>
        }
      >
        {slots.length === 0 ? (
          <p role="alert" className="text-error text-row">
            No spell slot is expended.
          </p>
        ) : (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 font-semibold text-label text-muted uppercase tracking-label">
              Slots to recover
            </legend>
            {slots.map(({ level, expended }) => (
              <label key={level} className="flex items-center gap-2 text-row">
                <input
                  id={`${id}-${level}`}
                  type="number"
                  min={0}
                  max={expended}
                  value={counts[level] ?? 0}
                  onChange={(event) =>
                    setCounts({
                      ...counts,
                      [level]: Math.max(0, Math.min(expended, event.target.valueAsNumber || 0)),
                    })
                  }
                  className="h-6 w-12 rounded-control border border-border bg-surface px-1 text-row"
                />
                <span>
                  Level {level} slots <span className="text-muted">({expended} expended)</span>
                </span>
              </label>
            ))}
            <p className="text-muted text-row">
              {spent} of {budget} slot {budget === 1 ? "level" : "levels"}
            </p>
          </fieldset>
        )}
        {error && (
          <p role="alert" className="text-error text-row">
            {name} was not used: {error}
          </p>
        )}
      </ModalEntry>
    </Modal>
  );
}

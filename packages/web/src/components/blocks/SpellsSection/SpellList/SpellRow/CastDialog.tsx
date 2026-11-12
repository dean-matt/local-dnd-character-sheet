import type { SpellCastOption } from "@dnd/character";
import { useId, useState } from "react";
import { levelLabel } from "../../../../../lib/spellLevel.ts";
import { Modal } from "../../../../Modal.tsx";
import { ModalEntry } from "../../../../ModalEntry.tsx";

const PRIMARY =
  "min-h-11 rounded-control bg-accent px-3.5 font-semibold text-row text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:text-muted";

const SECONDARY =
  "min-h-11 rounded-control px-3.5 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:text-muted";

type CastChoice = { option: SpellCastOption; spend: boolean; concentrate: boolean };

const optionKey = (option: SpellCastOption) => `${option.via}:${option.level}`;

const spendsSlot = (option: SpellCastOption) => option.via === "slot" || option.via === "pact";

function optionLabel(option: SpellCastOption) {
  const left = option.left === 0 ? "none left" : `${option.left} left`;
  if (option.via === "pact") return `Pact slot, level ${option.level}, ${left}`;
  if (option.via === "ritual") return "As a ritual, spending no slot";
  return `Level ${option.level} slot, ${left}`;
}

/**
 * The choices a cast takes before it is applied: the slot level, pact slot or ritual cast it
 * goes by, refusing a slot with none left while the spend is on; whether it spends that slot;
 * and, for a spell that needs concentration, whether it concentrates, naming the held spell it
 * ends. A cantrip offers no slot. `onCast` applies the choice and resolves whether it landed.
 */
export function CastDialog({
  name,
  level,
  concentration,
  options,
  held,
  busy,
  error,
  onCast,
  onClose,
}: {
  name: string;
  level: number;
  concentration: boolean;
  options: readonly SpellCastOption[];
  /** The spell concentration is held on, or undefined where none is. */
  held: string | undefined;
  busy: boolean;
  error: string | undefined;
  onCast: (choice: CastChoice) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [spend, setSpend] = useState(true);
  const [concentrate, setConcentrate] = useState(concentration);
  const usable = (option: SpellCastOption) => !(spend && spendsSlot(option) && option.left === 0);
  const [picked, setPicked] = useState(() => {
    const first = options.find((option) => option.left !== 0);
    return first && optionKey(first);
  });
  const option = options.find((each) => optionKey(each) === picked);
  const ready = option !== undefined && usable(option);
  const cantrip = level === 0;

  function cast() {
    if (busy || !option || !ready) return;
    onCast({ option, spend: spend && spendsSlot(option), concentrate });
  }

  return (
    <Modal onClose={() => !busy && onClose()} size="narrow">
      <ModalEntry
        title={`Cast ${name}`}
        meta={cantrip ? "Cantrip" : levelLabel(level)}
        footer={
          <div className="flex items-center gap-2">
            <button type="button" aria-disabled={busy} onClick={onClose} className={SECONDARY}>
              Cancel
            </button>
            <button type="button" aria-disabled={busy || !ready} onClick={cast} className={PRIMARY}>
              Cast
            </button>
          </div>
        }
      >
        {cantrip ? (
          <p className="text-row">A cantrip spends no slot.</p>
        ) : options.length === 0 ? (
          <p role="alert" className="text-error text-row">
            No spell slot can cast {name}.
          </p>
        ) : (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 font-semibold text-label text-muted uppercase tracking-label">
              Cast with
            </legend>
            {options.map((each) => (
              <label key={optionKey(each)} className="flex items-center gap-2 text-row">
                <input
                  type="radio"
                  name={`${id}-option`}
                  checked={picked === optionKey(each)}
                  disabled={!usable(each)}
                  onChange={() => setPicked(optionKey(each))}
                />
                {optionLabel(each)}
              </label>
            ))}
          </fieldset>
        )}
        {options.some(spendsSlot) && (
          <label className="flex items-center gap-2 text-row">
            <input type="checkbox" checked={spend} onChange={() => setSpend(!spend)} />
            Spend the slot
          </label>
        )}
        {concentration && (
          <label className="flex items-center gap-2 text-row">
            <input
              type="checkbox"
              checked={concentrate}
              onChange={() => setConcentrate(!concentrate)}
            />
            Concentrate
          </label>
        )}
        {concentration && concentrate && held && (
          <p className="text-muted text-row">Ends concentration on {held}.</p>
        )}
        {error && (
          <p role="alert" className="text-error text-row">
            {name} was not cast: {error}
          </p>
        )}
      </ModalEntry>
    </Modal>
  );
}

import type { SpellCastOption } from "@dnd/character";
import { useId, useState } from "react";
import { levelLabel } from "../../../../../lib/spellLevel.ts";
import { Modal } from "../../../../Modal.tsx";
import { ModalEntry } from "../../../../ModalEntry.tsx";

const PRIMARY =
  "min-h-11 rounded-control bg-accent px-3.5 font-semibold text-row text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:text-muted";

const SECONDARY =
  "min-h-11 rounded-control px-3.5 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:text-muted";

type CastChoice = {
  option: SpellCastOption;
  spend: boolean;
  concentrate: boolean;
  roll: boolean;
  /** The index of the inventory entry to spend, or undefined to spend none. */
  spendEntry: number | undefined;
};

const NO_ENTRY = "none";

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
 * ends; and, for a spell that makes an attack or deals damage, whether to roll them. A cast
 * that consumes a costly component asks which inventory entry pays for it, or to cast
 * without one, before it can go. A cantrip offers no slot. The caller applies the choice and
 * closes the dialog once it lands.
 */
export function CastDialog({
  name,
  level,
  concentration,
  rolls,
  options,
  held,
  consumed,
  inventory,
  busy,
  error,
  onCast,
  onClose,
}: {
  name: string;
  level: number;
  concentration: boolean;
  /** Whether the spell has an attack or damage to roll. */
  rolls: boolean;
  options: readonly SpellCastOption[];
  /** The spell concentration is held on, or undefined where none is. */
  held: string | undefined;
  /** The costly material component the cast uses up, where it uses one up. */
  consumed: { text: string; cost: string } | undefined;
  /** The entries a consumed component can be spent from, by their index in the inventory. */
  inventory: readonly { index: number; label: string }[];
  busy: boolean;
  error: string | undefined;
  onCast: (choice: CastChoice) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [spend, setSpend] = useState(true);
  const [concentrate, setConcentrate] = useState(concentration);
  const [roll, setRoll] = useState(true);
  const [paidBy, setPaidBy] = useState("");
  const usable = (option: SpellCastOption) => !(spend && spendsSlot(option) && option.left === 0);
  const [picked, setPicked] = useState(() => {
    const first = options.find((option) => option.left !== 0);
    return first && optionKey(first);
  });
  const option = options.find((each) => optionKey(each) === picked);
  const ready = option !== undefined && usable(option) && !(consumed && paidBy === "");
  const cantrip = level === 0;

  function cast() {
    if (busy || !option || !ready) return;
    onCast({
      option,
      spend: spend && spendsSlot(option),
      concentrate,
      roll: rolls && roll,
      spendEntry: consumed && paidBy !== NO_ENTRY ? Number(paidBy) : undefined,
    });
  }

  return (
    <Modal onClose={() => !busy && onClose()} size="narrow">
      <ModalEntry
        title={`Cast ${name}`}
        meta={cantrip ? "Cantrip" : levelLabel(level)}
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
        {rolls && (
          <label className="flex items-center gap-2 text-row">
            <input type="checkbox" checked={roll} onChange={() => setRoll(!roll)} />
            Roll attack and damage
          </label>
        )}
        {concentration && concentrate && held && (
          <p className="text-muted text-row">Ends concentration on {held}.</p>
        )}
        {consumed && (
          <>
            <p className="text-row">
              Consumes {consumed.text} ({consumed.cost}).
            </p>
            <label className="flex flex-col gap-1 text-row">
              Spend from the inventory
              <select
                value={paidBy}
                onChange={(event) => setPaidBy(event.target.value)}
                className="min-h-11 rounded-control border border-border bg-surface px-2"
              >
                <option value="" disabled>
                  Choose…
                </option>
                <option value={NO_ENTRY}>Cast without spending one</option>
                {inventory.map(({ index, label }) => (
                  <option key={index} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </>
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

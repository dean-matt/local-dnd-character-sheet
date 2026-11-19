import type { ConversionOption } from "@dnd/character";
import { useId, useState } from "react";
import { Modal } from "../../../Modal.tsx";
import { ModalEntry } from "../../../ModalEntry.tsx";
import { tradeWords } from "./tradeWords.ts";

const PRIMARY =
  "min-h-11 rounded-control bg-accent px-3.5 font-semibold text-row text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:text-muted";

const SECONDARY =
  "min-h-11 rounded-control px-3.5 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:text-muted";

const optionKey = (option: Pick<ConversionOption, "via" | "level">) =>
  `${option.via}:${option.level}`;

/**
 * The trades a feature makes between its pool and spell slots, one picked at a time; a refused
 * one is listed with its reason and cannot be picked. The caller applies the pick and closes the
 * dialog once it lands.
 */
export function ConvertDialog({
  name,
  pool,
  options,
  busy,
  error,
  onConvert,
  onClose,
}: {
  name: string;
  pool: string;
  options: readonly ConversionOption[];
  busy: boolean;
  error: string | undefined;
  onConvert: (option: ConversionOption) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [picked, setPicked] = useState(() => {
    const first = options.find((option) => option.refused === null);
    return first && optionKey(first);
  });
  const option = options.find((each) => optionKey(each) === picked && each.refused === null);
  const ready = option !== undefined && !busy;

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
              onClick={() => ready && onConvert(option)}
              className={PRIMARY}
            >
              Convert
            </button>
          </div>
        }
      >
        {options.length === 0 ? (
          <p role="alert" className="text-error text-row">
            No spell slot can be traded.
          </p>
        ) : (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 font-semibold text-label text-muted uppercase tracking-label">
              Trade
            </legend>
            {options.map((each) => (
              <label key={optionKey(each)} className="flex items-center gap-2 text-row">
                <input
                  type="radio"
                  name={`${id}-option`}
                  checked={picked === optionKey(each)}
                  disabled={each.refused !== null}
                  onChange={() => setPicked(optionKey(each))}
                />
                <span>
                  {tradeWords(each, pool)}
                  {each.refused && <span className="text-muted"> ({each.refused})</span>}
                </span>
              </label>
            ))}
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

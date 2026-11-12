import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  type HitPointMaximumReduction,
  hitPointMaximumUnder,
  maximumReducedState,
} from "@dnd/character";
import { useEffect, useRef, useState } from "react";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { Announcer } from "../../../Announcer.tsx";
import { InputField } from "../../../InputField.tsx";
import { BUTTON, parseAmount } from "./hitPointAmount.ts";

const lasting = ({ clearsOnLongRest }: HitPointMaximumReduction) =>
  clearsOnLongRest ? "until a long rest" : "past a long rest";

/**
 * The held reduction to the hit point maximum with Clear reduction, and Reduce maximum, which
 * opens a form setting the reduction's amount and whether it lasts past a long rest, in place
 * of any held. Each change is one write by `maximumReducedState`, announced with the hit points
 * it leaves. An amount that would leave no hit point maximum is refused before any write.
 */
export function MaximumReduction({
  character,
  derived,
  state,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  state: CharacterState;
}) {
  const replace = useAnnouncedStateWrite(character.id);
  const held = state.hitPointMaximumReduction;
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [persists, setPersists] = useState(false);
  const [invalid, setInvalid] = useState<string>();
  const [focusToggle, setFocusToggle] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const amountField = useRef<HTMLInputElement>(null);
  const unreduced = hitPointMaximumUnder(character.definition, derived, null);

  useEffect(() => {
    if (open) amountField.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!focusToggle) return;
    toggle.current?.focus();
    setFocusToggle(false);
  }, [focusToggle]);

  function begin() {
    setTyped(held ? String(held.amount) : "");
    setPersists(held ? !held.clearsOnLongRest : false);
    setInvalid(undefined);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setFocusToggle(true);
  }

  async function write(reduction: HitPointMaximumReduction | null, text: string) {
    if (replace.writing) return false;
    const after = maximumReducedState(character.definition, derived, state, reduction);
    const maximum = hitPointMaximumUnder(character.definition, derived, reduction);
    return replace.write(after, `${text} ${after.hitPoints.current ?? maximum} hit points.`);
  }

  async function apply() {
    const parsed = parseAmount(typed);
    if ("error" in parsed) {
      setInvalid(parsed.error);
      return;
    }
    if (parsed.amount >= unreduced) {
      setInvalid(`The reduction is less than the maximum, ${unreduced}.`);
      return;
    }
    const reduction = { amount: parsed.amount, clearsOnLongRest: !persists };
    if (await write(reduction, `Maximum reduced by ${reduction.amount}, ${lasting(reduction)}.`)) {
      close();
    }
  }

  async function clear() {
    if (await write(null, "Reduction cleared.")) setFocusToggle(true);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {held && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-row">
            <span className="text-muted">Maximum reduced by </span>
            <span className="font-semibold">{held.amount}</span>, {lasting(held)}
          </p>
          {!open && (
            <button
              type="button"
              aria-disabled={replace.writing}
              onClick={clear}
              className={`${BUTTON} border-border`}
            >
              Clear reduction
            </button>
          )}
        </div>
      )}
      {open ? (
        <form
          aria-label="Reduce hit point maximum"
          className="flex flex-wrap items-start gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <InputField
            ref={amountField}
            label="Reduction"
            labelHidden
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="0"
            value={typed}
            error={invalid}
            onChange={(event) => {
              setTyped(event.target.value);
              setInvalid(undefined);
            }}
            className="w-16"
          />
          <label className="flex h-8 items-center gap-1.5 text-row">
            <input type="checkbox" checked={persists} onChange={() => setPersists(!persists)} />
            Lasts past a long rest
          </label>
          <button
            type="submit"
            aria-disabled={replace.writing}
            className={`${BUTTON} border-accent text-accent-text`}
          >
            Reduce
          </button>
          <button type="button" onClick={close} className={`${BUTTON} border-border`}>
            Cancel
          </button>
        </form>
      ) : (
        <button
          ref={toggle}
          type="button"
          onClick={begin}
          className={`${BUTTON} self-start border-border`}
        >
          {held ? "Change reduction" : "Reduce maximum"}
        </button>
      )}
      {replace.error && (
        <p role="alert" className="text-error text-row">
          The maximum was not changed: {replace.error.message}
        </p>
      )}
      <Announcer announced={replace.announced} />
    </div>
  );
}

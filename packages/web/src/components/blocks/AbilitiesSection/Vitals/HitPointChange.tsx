import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  damagedState,
  derivedValue,
  healedState,
} from "@dnd/character";
import { useId, useState } from "react";
import { useReplaceCharacterState } from "../../../../hooks/useReplaceCharacterState.ts";
import { useReturnFocus } from "../../../../hooks/useReturnFocus.ts";
import { InputField } from "../../../InputField.tsx";
import { Modal } from "../../../Modal.tsx";
import { ModalEntry } from "../../../ModalEntry.tsx";

type Changed = ReturnType<typeof healedState>;

const BUTTON =
  "h-8 rounded-control border bg-surface px-3 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/** Why `typed` is no amount of damage or healing, or the whole number it is. */
function parseAmount(typed: string): { amount: number } | { error: string } {
  if (typed.trim() === "") return { error: "Enter an amount." };
  const amount = Number(typed);
  if (!Number.isInteger(amount)) return { error: "The amount is a whole number." };
  if (amount < 1) return { error: "The amount is 1 or more." };
  return { amount };
}

/**
 * The amount field with Damage and Heal, which write what `damagedState` or `healedState`
 * returns in one state write. Damage that leaves the character dead asks first. A failed write
 * keeps the amount and names the error, and the card goes on showing what the server holds,
 * since the cache takes only a write that lands.
 */
export function HitPointChange({
  character,
  derived,
  state,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  state: CharacterState;
}) {
  const replace = useReplaceCharacterState(character.id);
  const [typed, setTyped] = useState("");
  const [critical, setCritical] = useState(false);
  const [invalid, setInvalid] = useState<string>();
  const [confirming, setConfirming] = useState<{ amount: number; changed: Changed }>();
  const [announced, setAnnounced] = useState({ text: "", count: 0 });
  const [messages, setMessages] = useState<HTMLElement | null>(null);
  const damageButton = useReturnFocus<HTMLButtonElement>(confirming !== undefined);
  const criticalId = useId();
  const maximum = derivedValue(derived.hitPointMaximum);
  const atZero = (state.hitPoints.current ?? maximum) <= 0;

  async function write({ state: after, outcome }: Changed) {
    try {
      await replace.mutateAsync(after);
    } catch {
      return;
    }
    setTyped("");
    setCritical(false);
    const current = after.hitPoints.current ?? maximum;
    setAnnounced(({ count }) => ({
      text: `${current} hit points${current < 1 && outcome !== "conscious" ? `, ${outcome}` : ""}.`,
      count: count + 1,
    }));
  }

  function apply(kind: "damage" | "heal") {
    if (replace.isPending) return;
    const parsed = parseAmount(typed);
    if ("error" in parsed) {
      setInvalid(parsed.error);
      return;
    }
    if (kind === "heal") {
      write(healedState(derived, state, parsed.amount));
      return;
    }
    const changed = damagedState(
      character.definition,
      derived,
      state,
      parsed.amount,
      atZero && critical,
    );
    // Damage to the dead changes nothing, so there is nothing to confirm.
    if (
      changed.outcome === "dead" &&
      state.deathSaves.failures < changed.state.deathSaves.failures
    ) {
      setConfirming({ amount: parsed.amount, changed });
      return;
    }
    write(changed);
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <InputField
          label="Damage or healing amount"
          labelHidden
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          placeholder="0"
          value={typed}
          error={invalid}
          messageSlot={{ into: messages }}
          onChange={(event) => {
            setTyped(event.target.value);
            setInvalid(undefined);
          }}
          className="w-16"
        />
        {atZero && (
          <span className="flex items-center gap-1 text-row">
            <input
              id={criticalId}
              type="checkbox"
              checked={critical}
              onChange={(event) => setCritical(event.target.checked)}
            />
            <label htmlFor={criticalId}>Critical hit</label>
          </span>
        )}
        <button
          ref={damageButton}
          type="button"
          aria-disabled={replace.isPending}
          onClick={() => apply("damage")}
          className={`${BUTTON} border-accent text-accent-text`}
        >
          <span aria-hidden="true">− </span>Damage
        </button>
        <button
          type="button"
          aria-disabled={replace.isPending}
          onClick={() => apply("heal")}
          className={`${BUTTON} border-positive text-positive`}
        >
          <span aria-hidden="true">+ </span>Heal
        </button>
      </div>
      <div ref={setMessages} className="flex flex-col">
        {replace.error && (
          <p role="alert" className="mt-1 text-error text-row">
            Hit points were not changed: {replace.error.message}
          </p>
        )}
      </div>
      {/* Mounted while empty: a live region added with its text is often not announced.
          The keyed child replaces its node on every change, so a result that repeats the
          last one's text is announced again. */}
      <span role="status" className="sr-only">
        <span key={announced.count}>{announced.text}</span>
      </span>
      {confirming && (
        <Modal onClose={() => !replace.isPending && setConfirming(undefined)} size="narrow">
          <ModalEntry
            title={`${confirming.amount} damage kills ${character.name}`}
            footer={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-disabled={replace.isPending}
                  onClick={() => !replace.isPending && setConfirming(undefined)}
                  className="min-h-11 rounded-control px-3.5 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:text-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  aria-disabled={replace.isPending}
                  onClick={async () => {
                    if (replace.isPending) return;
                    await write(confirming.changed);
                    setConfirming(undefined);
                  }}
                  className="min-h-11 rounded-control bg-accent px-3.5 font-semibold text-row text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:text-muted"
                >
                  Apply the damage
                </button>
              </div>
            }
          >
            <p>{character.name} dies, and nothing on the sheet brings a dead character back.</p>
          </ModalEntry>
        </Modal>
      )}
    </div>
  );
}

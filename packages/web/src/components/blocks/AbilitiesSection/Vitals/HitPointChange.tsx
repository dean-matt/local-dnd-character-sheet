import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  damagedState,
  deathSaveStatus,
  derivedValue,
  healedState,
} from "@dnd/character";
import { useRef, useState } from "react";
import { useReplaceCharacterState } from "../../../../hooks/useReplaceCharacterState.ts";
import { useReturnFocus } from "../../../../hooks/useReturnFocus.ts";
import { InputField } from "../../../InputField.tsx";
import { Modal } from "../../../Modal.tsx";
import { ModalEntry } from "../../../ModalEntry.tsx";

type Changed = ReturnType<typeof healedState>;

const BUTTON =
  "h-8 rounded-control border bg-surface px-3 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/** Why `typed` is no amount of hit points, or the whole number it is. */
function parseAmount(typed: string): { amount: number } | { error: string } {
  if (typed.trim() === "") return { error: "Enter an amount." };
  const amount = Number(typed);
  if (!Number.isInteger(amount)) return { error: "The amount is a whole number." };
  if (amount < 1) return { error: "The amount is 1 or more." };
  return { amount };
}

function withTemporary(state: CharacterState, temporary: number): CharacterState {
  return { ...state, hitPoints: { ...state.hitPoints, temporary } };
}

/**
 * The amount field with Damage and Heal, which write what `damagedState` or `healedState`
 * returns, and Grant temp and Clear temp, which write the temporary hit points alone. Each is
 * one state write. Damage that leaves the character dead asks first. Temporary hit points do
 * not stack, so a grant no larger than those held keeps them and offers to take the grant
 * instead; a grant to the dead writes nothing. Either notice lasts only while the temporary hit
 * points and the death-save status it read stand. A failed write
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
  const [invalid, setInvalid] = useState<string>();
  const [confirming, setConfirming] = useState<{ amount: number; changed: Changed }>();
  const [notice, setNotice] = useState<{ text: string; instead?: number; read: string }>();
  const [announced, setAnnounced] = useState({ text: "", count: 0 });
  const [messages, setMessages] = useState<HTMLElement | null>(null);
  const damageButton = useReturnFocus<HTMLButtonElement>(confirming !== undefined);
  const grantButton = useRef<HTMLButtonElement>(null);
  const maximum = derivedValue(derived.hitPointMaximum);
  const { temporary } = state.hitPoints;
  const status = deathSaveStatus(derived, state);
  const read = `${temporary} ${status}`;
  const shown = notice?.read === read ? notice : undefined;

  function announce(text: string) {
    setAnnounced(({ count }) => ({ text, count: count + 1 }));
  }

  async function write(after: CharacterState, text: string) {
    try {
      await replace.mutateAsync(after);
    } catch {
      return false;
    }
    setTyped("");
    setNotice(undefined);
    announce(text);
    return true;
  }

  function writeHitPoints({ state: after }: Changed) {
    return write(after, `${after.hitPoints.current ?? maximum} hit points.`);
  }

  function writeTemporary(amount: number) {
    return write(withTemporary(state, amount), `${amount} temporary hit points.`);
  }

  /** For a control the write removes, so focus does not fall to the page. */
  async function writeTemporaryFrom(amount: number) {
    if (replace.writing) return;
    if (await writeTemporary(amount)) grantButton.current?.focus();
  }

  function say(text: string, instead?: number) {
    setNotice({ text, instead, read });
    announce(text);
  }

  function grant(amount: number) {
    if (status === "dead") {
      say(`${character.name} is dead, so temporary hit points were not granted.`);
    } else if (amount > temporary) {
      writeTemporary(amount);
    } else {
      say(
        `Kept ${temporary} temporary hit points: they do not stack, and ${amount} is no more.`,
        amount < temporary ? amount : undefined,
      );
    }
  }

  function apply(kind: "damage" | "heal" | "temporary") {
    if (replace.writing) return;
    setNotice(undefined);
    const parsed = parseAmount(typed);
    if ("error" in parsed) {
      setInvalid(parsed.error);
      return;
    }
    if (kind === "temporary") {
      grant(parsed.amount);
      return;
    }
    if (kind === "heal") {
      writeHitPoints(healedState(derived, state, parsed.amount));
      return;
    }
    const changed = damagedState(character.definition, derived, state, parsed.amount);
    // Damage to the dead changes nothing, so there is nothing to confirm.
    if (
      changed.outcome === "dead" &&
      state.deathSaves.failures < changed.state.deathSaves.failures
    ) {
      setConfirming({ amount: parsed.amount, changed });
      return;
    }
    writeHitPoints(changed);
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <InputField
          label="Hit point amount"
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
            setNotice(undefined);
          }}
          className="w-16"
        />
        <button
          ref={damageButton}
          type="button"
          aria-disabled={replace.writing}
          onClick={() => apply("damage")}
          className={`${BUTTON} border-accent text-accent-text`}
        >
          <span aria-hidden="true">− </span>Damage
        </button>
        <button
          type="button"
          aria-disabled={replace.writing}
          onClick={() => apply("heal")}
          className={`${BUTTON} border-positive text-positive`}
        >
          <span aria-hidden="true">+ </span>Heal
        </button>
        <button
          ref={grantButton}
          type="button"
          aria-disabled={replace.writing}
          onClick={() => apply("temporary")}
          className={`${BUTTON} border-border`}
        >
          Grant temp
        </button>
        {temporary > 0 && (
          <button
            type="button"
            aria-disabled={replace.writing}
            onClick={() => writeTemporaryFrom(0)}
            className={`${BUTTON} border-border`}
          >
            Clear temp
          </button>
        )}
      </div>
      <div ref={setMessages} className="flex flex-col">
        {replace.error && (
          <p role="alert" className="mt-1 text-error text-row">
            Hit points were not changed: {replace.error.message}
          </p>
        )}
        {shown && (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-secondary text-row">
            {shown.text}
            {shown.instead !== undefined && (
              <button
                type="button"
                aria-disabled={replace.writing}
                onClick={() => shown.instead !== undefined && writeTemporaryFrom(shown.instead)}
                className={`${BUTTON} border-border text-ink`}
              >
                Take {shown.instead} instead
              </button>
            )}
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
        <Modal onClose={() => !replace.writing && setConfirming(undefined)} size="narrow">
          <ModalEntry
            title={`${confirming.amount} damage kills ${character.name}`}
            footer={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-disabled={replace.writing}
                  onClick={() => !replace.writing && setConfirming(undefined)}
                  className="min-h-11 rounded-control px-3.5 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:text-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  aria-disabled={replace.writing}
                  onClick={async () => {
                    if (replace.writing) return;
                    await writeHitPoints(confirming.changed);
                    setConfirming(undefined);
                  }}
                  className="min-h-11 rounded-control bg-accent px-3.5 font-semibold text-row text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:text-muted"
                >
                  Apply the damage
                </button>
              </div>
            }
          >
            <p>
              {character.name} dies. Clearing a death save failure brings them back, still at 0 hit
              points.
            </p>
          </ModalEntry>
        </Modal>
      )}
    </div>
  );
}

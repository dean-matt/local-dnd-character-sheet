import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  concentrationCheck,
  concentrationEnded,
  damagedState,
  deathSaveStatus,
  derivedValue,
  healedState,
} from "@dnd/character";
import { useRef, useState } from "react";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { useReturnFocus } from "../../../../hooks/useReturnFocus.ts";
import { capitalize } from "../../../../lib/capitalize.ts";
import { DAMAGE_TYPE_NAMES } from "../../../../lib/defenseVocabulary.ts";
import { Announcer } from "../../../Announcer.tsx";
import { FormField } from "../../../FormField.tsx";
import { InputField } from "../../../InputField.tsx";
import { Modal } from "../../../Modal.tsx";
import { ModalEntry } from "../../../ModalEntry.tsx";
import { Select } from "../../../Select.tsx";
import { signed } from "../../signed.ts";

type Changed = ReturnType<typeof healedState>;
type Damaged = ReturnType<typeof damagedState>;

const UNTYPED = "";

const DAMAGE_TYPES = [{ value: UNTYPED, label: "Untyped" }, ...DAMAGE_TYPE_NAMES];

const VERBS = { immunity: "reduced", resistance: "halved", vulnerability: "doubled" } as const;

const conjunction = new Intl.ListFormat("en", { type: "conjunction" });

/** What the defenses did to typed damage, or nothing where none changed it. */
function defended(type: string, entered: number, { amount, applied }: Damaged) {
  const [only] = applied;
  if (only === undefined) return undefined;
  const verb = applied.length === 1 ? VERBS[only] : "changed";
  return `${capitalize(type)} ${conjunction.format(applied)} ${verb} ${entered} damage to ${amount}.`;
}

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

/** What a notice depends on: it shows only while these stand, so an undo or a rest drops it. */
function standing({ hitPoints }: CharacterState, status?: string) {
  return `${hitPoints.current} ${hitPoints.temporary} ${status}`;
}

/** What a concentration prompt depends on: the hit points it followed and the spell held. */
function concentrating(state: CharacterState, status?: string) {
  return `${standing(state, status)} ${JSON.stringify(state.concentration)}`;
}

/**
 * The amount field, the damage type and Critical hit with Damage and Heal, which write what
 * `damagedState` or `healedState` returns, and Grant temp and Clear temp, which write the temporary hit points
 * alone. Each is one state write. Typed damage names the defense that changed it, and damage a
 * defense reduces to nothing writes nothing. Damage that leaves the character dead asks first.
 * Temporary hit points do not stack, so a grant no larger than those held keeps them and offers
 * to take the grant instead; a grant to the dead writes nothing. Damage that leaves a
 * concentrating character at 0 ends concentration in the same write, and says so; above 0 it
 * shows the Constitution save it calls for, with End concentration, one write, and Keep, which
 * writes nothing. A notice lasts only while the hit points, temporary hit points and death-save
 * status it read stand, and the concentration prompt while those and the spell held stand. A
 * failed write keeps the amount and names the error, and the card goes on showing what the
 * server holds, since the cache takes only a write that lands.
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
  const replace = useAnnouncedStateWrite(character.id);
  const [typed, setTyped] = useState("");
  const [damageType, setDamageType] = useState(UNTYPED);
  const [critical, setCritical] = useState(false);
  const [invalid, setInvalid] = useState<string>();
  const [confirming, setConfirming] = useState<{ changed: Damaged; defense?: string }>();
  const [notice, setNotice] = useState<{ text: string; instead?: number; read: string }>();
  const [ending, setEnding] = useState(false);
  const [saving, setSaving] = useState<{ dc: number; save: number; read: string }>();
  const [messages, setMessages] = useState<HTMLElement | null>(null);
  const damageButton = useReturnFocus<HTMLButtonElement>(confirming !== undefined);
  const grantButton = useRef<HTMLButtonElement>(null);
  const maximum = derivedValue(derived.hitPointMaximum);
  const { temporary } = state.hitPoints;
  const status = deathSaveStatus(derived, state);
  const read = standing(state, status);
  const shown = notice?.read === read ? notice : undefined;
  const prompt = saving?.read === concentrating(state, status) ? saving : undefined;

  async function write(after: CharacterState, text: string) {
    setEnding(false);
    if (!(await replace.write(after, text))) return false;
    setTyped("");
    setNotice(undefined);
    return true;
  }

  function writeHitPoints({ state: after }: Changed) {
    return write(after, `${after.hitPoints.current ?? maximum} hit points.`);
  }

  /**
   * The damage, with the defense that changed it shown until the state it left changes, and
   * the concentration save it calls for while the character still holds a spell.
   */
  async function writeDamage({ state: after, amount }: Damaged, defense?: string) {
    const outcome = deathSaveStatus(derived, after);
    const check = after.concentration && concentrationCheck(character.definition, derived, amount);
    const text = [
      defense,
      `${after.hitPoints.current ?? maximum} hit points.`,
      check && `DC ${check.dc} Constitution save to keep concentration.`,
      state.concentration && !after.concentration && "Concentration ended.",
    ];
    if (!(await write(after, text.filter(Boolean).join(" ")))) return;
    setDamageType(UNTYPED);
    setCritical(false);
    if (check) setSaving({ ...check, read: concentrating(after, outcome) });
    if (defense) {
      setNotice({ text: defense, read: standing(after, outcome) });
    }
  }

  /** For a prompt control the answer removes, so focus does not fall to the page. */
  async function answerConcentration(end: boolean) {
    if (replace.writing) return;
    if (end) {
      setEnding(true);
      if (!(await replace.write(concentrationEnded(state), "Concentration ended."))) return;
    } else {
      replace.announce("Concentration kept.");
    }
    setSaving(undefined);
    damageButton.current?.focus();
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
    replace.announce(text);
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

  function damage(entered: number) {
    const type = damageType === UNTYPED ? undefined : damageType;
    const changed = damagedState(character.definition, derived, state, entered, { type, critical });
    const defense = type && defended(type, entered, changed);
    if (changed.amount === 0) {
      setTyped("");
      setDamageType(UNTYPED);
      setCritical(false);
      say(`${defense} Hit points are unchanged.`);
      return;
    }
    // Damage to the dead changes nothing, so there is nothing to confirm.
    if (
      changed.outcome === "dead" &&
      state.deathSaves.failures < changed.state.deathSaves.failures
    ) {
      setConfirming({ changed, defense });
      return;
    }
    writeDamage(changed, defense);
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
    damage(parsed.amount);
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
        <FormField label="Damage type" labelHidden className="w-32">
          {(control) => (
            <Select
              {...control}
              aria-disabled={replace.writing}
              value={damageType}
              options={DAMAGE_TYPES}
              onChange={setDamageType}
            />
          )}
        </FormField>
        <label className="flex items-center gap-1.5 text-row">
          <input
            type="checkbox"
            checked={critical}
            aria-disabled={replace.writing}
            onChange={() => !replace.writing && setCritical(!critical)}
          />
          Critical hit
        </label>
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
            {ending ? "Concentration was not ended" : "Hit points were not changed"}:{" "}
            {replace.error.message}
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
        {prompt && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-row">
            <p>
              <span className="text-muted">Concentration: </span>DC {prompt.dc} Constitution save,{" "}
              {signed(prompt.save)}
            </p>
            <button
              type="button"
              aria-disabled={replace.writing}
              onClick={() => answerConcentration(true)}
              className={`${BUTTON} border-border`}
            >
              End concentration
            </button>
            <button
              type="button"
              aria-disabled={replace.writing}
              aria-label="Keep concentration"
              onClick={() => answerConcentration(false)}
              className={`${BUTTON} border-border`}
            >
              Keep
            </button>
          </div>
        )}
      </div>
      <Announcer announced={replace.announced} />
      {confirming && (
        <Modal onClose={() => !replace.writing && setConfirming(undefined)} size="narrow">
          <ModalEntry
            title={`${confirming.changed.amount} damage kills ${character.name}`}
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
                    await writeDamage(confirming.changed, confirming.defense);
                    setConfirming(undefined);
                  }}
                  className="min-h-11 rounded-control bg-accent px-3.5 font-semibold text-row text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:text-muted"
                >
                  Apply the damage
                </button>
              </div>
            }
          >
            {confirming.defense && <p>{confirming.defense}</p>}
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

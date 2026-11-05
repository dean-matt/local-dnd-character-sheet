import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  deathSaveRolledState,
  deathSaveStatus,
} from "@dnd/character";
import { rollDice } from "@dnd/dice";
import { useState } from "react";
import { useReplaceCharacterState } from "../../../../hooks/useReplaceCharacterState.ts";

type Column = keyof CharacterState["deathSaves"];

type Rolled = ReturnType<typeof deathSaveRolledState>;

const MARKS = [1, 2, 3] as const;

const COLUMNS = [
  {
    column: "successes",
    label: "Successes",
    mark: "Success",
    className: "border-positive aria-pressed:bg-positive",
  },
  {
    column: "failures",
    label: "Failures",
    mark: "Failure",
    className: "border-error aria-pressed:bg-error",
  },
] as const;

const MARK =
  "size-6 rounded-full border-2 bg-surface aria-disabled:cursor-not-allowed forced-colors:aria-pressed:bg-[Highlight]";

const BUTTON =
  "h-8 rounded-control border border-border bg-surface px-3 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * What a roll did, read from the rule's result rather than its thresholds. A natural 1 is
 * named from the die, since a third failure caps the count it raised.
 */
function verdict(roll: number, before: CharacterState, { state: after, outcome }: Rolled) {
  if (outcome === "conscious") return "a natural 20";
  if (after.deathSaves.successes > before.deathSaves.successes || outcome === "stable") {
    return "a success";
  }
  return roll === 1 ? "a natural 1, two failures" : "a failure";
}

/**
 * The death save marks of a character at 0 hit points, set or cleared by hand, and a Roll
 * button while dying. Each change is one state write, so a failed write leaves the marks as
 * the server holds them and names the error. Mounted at any hit points, so the live region
 * outlasts the 20 that takes the marks away.
 */
export function DeathSaves({
  character,
  derived,
  state,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  state: CharacterState;
}) {
  const replace = useReplaceCharacterState(character.id);
  const [lastRoll, setLastRoll] = useState<number>();
  const [announced, setAnnounced] = useState({ text: "", count: 0 });
  const status = deathSaveStatus(derived, state);
  // A roll speaks for the dying it was rolled in; leaving that ends it.
  if (status !== "dying" && lastRoll !== undefined) setLastRoll(undefined);

  function summary(after: CharacterState) {
    const now = deathSaveStatus(derived, after);
    if (!now) return "Conscious at 1 hit point";
    const { successes, failures } = after.deathSaves;
    return `${plural(successes, "success", "successes")}, ${plural(failures, "failure", "failures")}, ${now}`;
  }

  async function write(after: CharacterState, text: string) {
    try {
      await replace.mutateAsync(after);
    } catch {
      return false;
    }
    setAnnounced(({ count }) => ({ text, count: count + 1 }));
    return true;
  }

  async function roll() {
    if (replace.writing) return;
    const d20 = rollDice("1d20").total;
    const rolled = deathSaveRolledState(derived, state, d20);
    const after = rolled.state;
    if (await write(after, `Rolled ${d20}: ${verdict(d20, state, rolled)}. ${summary(after)}.`)) {
      setLastRoll(d20);
    }
  }

  function mark(column: Column, index: number) {
    if (replace.writing) return;
    const count = index <= state.deathSaves[column] ? index - 1 : index;
    const after = { ...state, deathSaves: { ...state.deathSaves, [column]: count } };
    setLastRoll(undefined);
    write(after, `${summary(after)}.`);
  }

  // A fragment, so the card's gap opens only around what shows.
  return (
    <>
      {status && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {COLUMNS.map(({ column, label, mark: name, className }) => (
            // The button's height, so the marks hold still when it comes or goes.
            <fieldset key={column} className="flex h-8 items-center gap-1">
              <legend className="sr-only">Death save {column}</legend>
              <span aria-hidden="true" className="text-label text-muted">
                {label}
              </span>
              {MARKS.map((index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`${name} ${index}`}
                  aria-pressed={index <= state.deathSaves[column]}
                  aria-disabled={replace.writing}
                  onClick={() => mark(column, index)}
                  className={`${MARK} ${className}`}
                />
              ))}
            </fieldset>
          ))}
          {status === "dying" && (
            <div className="ml-auto flex items-center gap-2">
              {lastRoll !== undefined && (
                <span className="text-muted text-row">Rolled {lastRoll}</span>
              )}
              <button
                type="button"
                aria-disabled={replace.writing}
                onClick={roll}
                className={BUTTON}
              >
                Roll death save
              </button>
            </div>
          )}
        </div>
      )}
      {replace.error && (
        <p role="alert" className="text-error text-row">
          Death saves were not changed: {replace.error.message}
        </p>
      )}
      {/* Mounted while empty, and keyed, as the hit point change's region is. */}
      <span role="status" className="sr-only">
        <span key={announced.count}>{announced.text}</span>
      </span>
    </>
  );
}

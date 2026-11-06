import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  deathSaveRolledState,
  deathSaveStatus,
} from "@dnd/character";
import { rollDice } from "@dnd/dice";
import { useState } from "react";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { Announcer } from "../../../Announcer.tsx";
import { Card } from "../../../Card.tsx";

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

const STATUS = { dying: "Dying", stable: "Stable", dead: "Dead" } as const;

/** What an announcement reads from: the status and both counts. */
function key(status: string | undefined, { deathSaves }: CharacterState) {
  return `${status}:${deathSaves.successes}:${deathSaves.failures}`;
}

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
 * The Death Saves card: three success and three failure marks filled to the stored counts,
 * each set or cleared by hand at any hit points, and a Roll button while dying. At 0 hit
 * points the header reads Dying, Stable or Dead. Each change is one state write, so a failed
 * write leaves the marks as the server holds them and names the error. A change another
 * control writes, such as damage at 0, is announced here too.
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
  const replace = useAnnouncedStateWrite(character.id);
  const [lastRoll, setLastRoll] = useState<number>();
  const status = deathSaveStatus(derived, state);
  // A roll speaks for the dying it was rolled in; leaving that ends it.
  if (status !== "dying" && lastRoll !== undefined) setLastRoll(undefined);

  // This card's own writes announce themselves, so `own` holds the key of the one in flight.
  const seen = key(status, state);
  const [heard, setHeard] = useState(seen);
  const [own, setOwn] = useState<string>();
  if (heard !== seen) {
    setHeard(seen);
    if (seen === own) setOwn(undefined);
    else if (status) replace.announce(`${summary(state)}.`);
  }

  function summary(after: CharacterState) {
    const now = deathSaveStatus(derived, after);
    const { successes, failures } = after.deathSaves;
    return `${plural(successes, "success", "successes")}, ${plural(failures, "failure", "failures")}${now ? `, ${now}` : ""}`;
  }

  async function write(after: CharacterState, text: string) {
    setOwn(key(deathSaveStatus(derived, after), after));
    const landed = await replace.write(after, text);
    if (!landed) setOwn(undefined);
    return landed;
  }

  async function roll() {
    if (replace.writing) return;
    const d20 = rollDice("1d20").total;
    const rolled = deathSaveRolledState(derived, state, d20);
    const after = rolled.state;
    const result = rolled.outcome === "conscious" ? "Conscious at 1 hit point" : summary(after);
    if (await write(after, `Rolled ${d20}: ${verdict(d20, state, rolled)}. ${result}.`)) {
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

  return (
    <Card
      title="Death Saves"
      // One width in every state, sized for "Stable" or "Dying" and "Rolled 20", so the
      // card never grows when the Roll row appears.
      className="w-52 max-w-full justify-self-start"
      aside={
        status && (
          <span
            className={`font-semibold text-row ${status === "stable" ? "text-positive" : "text-error"}`}
          >
            {STATUS[status]}
          </span>
        )
      }
    >
      <div className="flex flex-col gap-1">
        {COLUMNS.map(({ column, label, mark: name, className }) => (
          <fieldset key={column} className="flex items-center gap-1">
            <legend className="sr-only">Death save {column}</legend>
            <span aria-hidden="true" className="min-w-14 text-label text-muted">
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
      </div>
      {/* Below the marks, so it never moves them when it comes or goes. */}
      {status === "dying" && (
        <div className="mt-1.5 flex items-center gap-2">
          <button type="button" aria-disabled={replace.writing} onClick={roll} className={BUTTON}>
            Roll death save
          </button>
          {lastRoll !== undefined && <span className="text-muted text-row">Rolled {lastRoll}</span>}
        </div>
      )}
      {replace.error && (
        <p role="alert" className="mt-1 text-error text-row">
          Death saves were not changed: {replace.error.message}
        </p>
      )}
      <Announcer announced={replace.announced} />
    </Card>
  );
}

import {
  averageHitPoints,
  type CharacterDefinition,
  type HitDie,
  hitPointSource,
} from "@dnd/character";
import { rollDice } from "@dnd/dice";
import { draftedGain, type GainDraft, typedGainMessage } from "../../../lib/levelGain.ts";
import { InputField } from "../../InputField.tsx";

type Level = CharacterDefinition["levels"][number];

/** Which button a drafted gain presses, and what the typed field shows. */
function drafted(draft: GainDraft) {
  if (draft.kind === "typed") return { source: "typed", text: draft.text };
  return draft.kind === "roll"
    ? { source: "rolled", text: String(draft.face) }
    : { source: "average", text: "" };
}

function stored(entry: Pick<Level, "rolled" | "typed">, die: HitDie) {
  return {
    source: hitPointSource({ die, ...entry }, false),
    text: entry.rolled === undefined ? "" : String(entry.rolled),
  };
}

const BUTTON =
  "rounded-control border border-border bg-surface px-2 py-1 font-semibold text-row aria-pressed:border-accent aria-pressed:text-accent-text";

/**
 * One level's hit point gain after the first, as `entry` stores it until `draft` holds a new
 * one: the average, a roll of the level's die, or a number typed in, which may pass the die.
 * The first level takes the die's highest face whatever is stored, so it says so rather than
 * offer a change that does nothing.
 */
export function LevelGainEdit({
  level,
  die,
  entry,
  draft,
  onDraft,
  refused,
}: {
  /** The character level, counting from 1. */
  level: number;
  die: HitDie;
  entry: Pick<Level, "rolled" | "typed">;
  draft: GainDraft | undefined;
  onDraft: (draft: GainDraft) => void;
  /** Set once Apply found the typed text no gain. */
  refused: boolean;
}) {
  if (level === 1) {
    return (
      <p className="text-label text-muted">Highest face of the d{die}; a roll cannot change it.</p>
    );
  }
  const average = averageHitPoints(die);
  const { source, text } = draft ? drafted(draft) : stored(entry, die);
  const edit = draft && draftedGain(draft);

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5 border-0 p-0">
      <legend className="sr-only">
        Level {level} hit points, d{die}
      </legend>
      <div className="flex flex-wrap items-start gap-1.5">
        <button
          type="button"
          aria-pressed={source === "average"}
          onClick={() => onDraft({ kind: "average" })}
          className={BUTTON}
        >
          Average ({average})
        </button>
        <button
          type="button"
          aria-pressed={source === "rolled"}
          onClick={() => onDraft({ kind: "roll", face: rollDice(`1d${die}`).total })}
          className={BUTTON}
        >
          {source === "rolled" ? "Reroll" : "Roll"} (d{die})
        </button>
        <InputField
          label={`Level ${level} typed gain`}
          labelHidden
          type="number"
          min={1}
          step={1}
          placeholder="Type a gain"
          value={text}
          onChange={(event) => onDraft({ kind: "typed", text: event.target.value })}
          error={refused && typedGainMessage}
          className="w-24 text-row"
        />
      </div>
      <p aria-live="polite" className="text-muted text-row">
        {edit?.kind === "roll" && `Rolled ${edit.face} on the d${die}`}
      </p>
    </fieldset>
  );
}

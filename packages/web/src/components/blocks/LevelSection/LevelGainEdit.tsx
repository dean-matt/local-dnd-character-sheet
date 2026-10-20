import {
  averageHitPoints,
  type CharacterDefinition,
  type HitDie,
  hitPointSource,
} from "@dnd/character";
import { rollDice } from "@dnd/dice";
import { type FormEvent, useId, useState } from "react";
import { type GainEdit, typedGain, typedGainMessage } from "../../../lib/levelGain.ts";
import { InputField } from "../../InputField.tsx";

type Level = CharacterDefinition["levels"][number];

const BUTTON =
  "rounded-control border border-border bg-surface px-2 py-1 font-semibold text-row aria-pressed:border-accent aria-pressed:text-accent-text";

/**
 * Changes one level's hit point gain after the first: the average, a roll of the level's
 * die, or a number typed in, which may pass the die. The first level takes the die's highest
 * face whatever is stored, so its row says so rather than offer a change that does nothing.
 */
export function LevelGainEdit({
  level,
  die,
  entry,
  onEdit,
  invalid,
}: {
  /** The character level, counting from 1. */
  level: number;
  die: HitDie;
  entry: Pick<Level, "rolled" | "typed">;
  onEdit: (edit: GainEdit) => void;
  invalid: boolean;
}) {
  const panel = useId();
  const [open, setOpen] = useState(false);
  // Follows the stored gain until the player types, so a roll or an undo never leaves a stale number to Set.
  const [draft, setDraft] = useState<string>();
  const text = draft ?? (entry.rolled === undefined ? "" : String(entry.rolled));
  const [refused, setRefused] = useState(false);

  if (level === 1) {
    return (
      <p className="text-label text-muted">Highest face of the d{die}; a roll cannot change it.</p>
    );
  }
  const source = hitPointSource({ die, ...entry }, false);
  const average = averageHitPoints(die);

  function submit(event: FormEvent) {
    event.preventDefault();
    const gain = typedGain(text);
    setRefused(gain === undefined);
    if (gain !== undefined) onEdit({ kind: "typed", gain });
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        aria-label={`Change level ${level} hit points`}
        onClick={() => setOpen(!open)}
        className="text-label text-muted underline"
      >
        Change
      </button>
      {open && (
        <fieldset id={panel} className="mt-1 flex min-w-0 flex-col gap-1.5 border-0 p-0">
          <legend className="sr-only">
            Level {level} hit points, d{die}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              aria-pressed={source === "average"}
              onClick={() => {
                setDraft(undefined);
                onEdit({ kind: "average" });
              }}
              className={BUTTON}
            >
              Average ({average})
            </button>
            <button
              type="button"
              aria-pressed={source === "rolled"}
              onClick={() => {
                setDraft(undefined);
                onEdit({ kind: "roll", face: rollDice(`1d${die}`).total });
              }}
              className={BUTTON}
            >
              {source === "rolled" ? "Reroll" : "Roll"} (d{die})
            </button>
          </div>
          <form noValidate onSubmit={submit} className="flex items-start gap-1.5">
            <InputField
              label={`Level ${level} typed gain`}
              labelHidden
              type="number"
              min={1}
              step={1}
              placeholder="Type a gain"
              value={text}
              onChange={(event) => {
                setDraft(event.target.value);
                setRefused(false);
              }}
              error={refused && typedGainMessage}
              invalid={invalid}
              className="w-24 text-row"
            />
            <button type="submit" className={BUTTON}>
              Set
            </button>
          </form>
        </fieldset>
      )}
    </div>
  );
}

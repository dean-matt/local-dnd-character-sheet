import type { CharacterRecord, CharacterState } from "@dnd/character";
import { Minus, Plus, X } from "lucide-react";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { PILL } from "../../../../lib/chipStyles.ts";
import { Announcer } from "../../../Announcer.tsx";
import { Card } from "../../../Card.tsx";
import { EmptyNote } from "../../../EmptyNote.tsx";
import { AddCondition } from "./AddCondition.tsx";

const STEP =
  "flex size-8 items-center justify-center rounded-control border border-border bg-surface hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/**
 * The Status Effects card: a chip per held condition with a remove control, an add control
 * over the edition's catalog conditions, and an exhaustion stepper from 0 to 6. Each change
 * is one state write, announced once it lands.
 */
export function StatusEffects({
  character,
  state,
}: {
  character: CharacterRecord;
  state: CharacterState;
}) {
  const replace = useAnnouncedStateWrite(character.id);
  // A chip shows the name alone, so one condition held from two sources reads as one chip.
  const names = [...new Set(state.conditions.map((condition) => condition.name))];
  const { exhaustion } = state;

  function add(ref: { name: string; source: string }) {
    replace.write({ ...state, conditions: [...state.conditions, ref] }, `${ref.name} added`);
  }

  function remove(name: string) {
    if (replace.writing) return;
    replace.write(
      { ...state, conditions: state.conditions.filter((condition) => condition.name !== name) },
      `${name} removed`,
    );
  }

  function step(by: 1 | -1) {
    const level = exhaustion + by;
    if (replace.writing || level < 0 || level > 6) return;
    replace.write(
      { ...state, exhaustion: level },
      level === 0 ? "Exhaustion cleared" : `Exhaustion ${level}`,
    );
  }

  return (
    <Card title="Status Effects">
      {names.length === 0 && exhaustion === 0 ? (
        <EmptyNote>No active conditions.</EmptyNote>
      ) : (
        <ul className="flex flex-wrap gap-1">
          {names.map((name) => (
            <li key={name} className={`${PILL} flex items-center gap-1`}>
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                aria-disabled={replace.writing}
                onClick={() => remove(name)}
                className="text-muted hover:text-ink"
              >
                <X size={12} aria-hidden />
              </button>
            </li>
          ))}
          {exhaustion > 0 && <li className={PILL}>Exhaustion {exhaustion}</li>}
        </ul>
      )}
      <AddCondition
        edition={character.edition}
        held={new Set(names)}
        busy={replace.writing}
        onAdd={add}
      />
      <div className="mt-2 flex items-center gap-2">
        <span className="text-label text-muted">Exhaustion level</span>
        <button
          type="button"
          aria-label="Lower exhaustion"
          aria-disabled={replace.writing || exhaustion === 0}
          onClick={() => step(-1)}
          className={STEP}
        >
          <Minus size={14} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Raise exhaustion"
          aria-disabled={replace.writing || exhaustion === 6}
          onClick={() => step(1)}
          className={STEP}
        >
          <Plus size={14} aria-hidden />
        </button>
      </div>
      {state.activeEffects.length > 0 && (
        <p className="mt-2 text-row">
          <span className="text-muted">Active effects: </span>
          {state.activeEffects.map((effect) => effect.name).join(", ")}
        </p>
      )}
      {replace.error && (
        <p role="alert" className="mt-1 text-error text-row">
          Status effects were not changed: {replace.error.message}
        </p>
      )}
      <Announcer announced={replace.announced} />
    </Card>
  );
}

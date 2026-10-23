import { type CharacterDefinition, displayName, entryKey, type HitDie } from "@dnd/character";
import { type ReactNode, useId } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { levelChoiceRefusals } from "../../../lib/levelChoices.ts";
import { Modal } from "../../Modal.tsx";
import { ModalEntry } from "../../ModalEntry.tsx";
import { LevelEditAlert } from "./LevelEditAlert.tsx";
import { LevelUpPicks } from "./LevelUpPicks.tsx";
import { type StartingSwap, withReopenedLevel } from "./reopenedLevel.ts";
import { StartingClassField } from "./StartingClassField.tsx";
import { StartingPicksFields } from "./StartingPicksFields.tsx";
import { useLaterPrerequisites } from "./useLaterPrerequisites.ts";
import { useLevelUpPlan } from "./useLevelUpPlan.ts";
import { useStartingClassGrants } from "./useStartingClassGrants.ts";

const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-row";

export interface LevelEditFormProps {
  /** The definition before `level` chose anything, which the pickers read. */
  before: CharacterDefinition;
  /** The definition as the dialog opened on it. */
  definition: CharacterDefinition;
  level: number;
  saving: boolean;
  error: string | undefined;
  /** Offered beside `error` where reading the character again is the way past it. */
  onReload?: () => void;
  /** Runs as Apply submits, with what a new starting class trades, which the write applies to the latest record. */
  onSwap: (swap: StartingSwap | undefined) => void;
  /** The control that drafts this level's hit point gain, given the drafted class's die once it loads. */
  hitPoints: (die: HitDie | undefined) => ReactNode;
  /** Set while `hitPoints` holds a gain Apply would write. */
  gainChanged: boolean;
  /** Offered for a level past the first, to remove it and every level after it. */
  onRemove?: () => void;
  cancel: () => void;
}

function asksNothing(plan: ReturnType<typeof useLevelUpPlan>) {
  const { owed } = plan.spellPicks;
  return (
    plan.target.read &&
    !plan.target.asksSubclass &&
    plan.grant === undefined &&
    plan.offerings.length === 0 &&
    plan.optionPicks.gains.length === 0 &&
    owed.cantrips + owed.spells + owed.subclassCantrips + owed.subclassSpells === 0
  );
}

/**
 * A past level's hit point gain and picks inside the level-up form, and the Apply that writes
 * them once the gain or a pick changed. A changed pick also waits until every pick is made and
 * nothing that depends on it would be left behind; each such dependency is named instead. A multiclass
 * prerequisite the change leaves unmet is named and noted as a departure, as the level-up
 * notes one, and never refuses.
 * Level 1 also offers its class: a new one takes back the old one's level 1 skill and tool
 * picks and asks the new one's, and Apply waits until they are made, then hands `onSwap` what
 * the old one granted and what the new one grants. A later level's class is not offered.
 */
export function LevelEditForm({
  before,
  definition,
  level,
  saving,
  error,
  onReload,
  onSwap,
  hitPoints,
  gainChanged,
  onRemove,
  cancel,
}: LevelEditFormProps) {
  const id = useId();
  const { getValues, setValue, formState } = useFormContext<CharacterDefinition>();
  const cls = definition.levels[level - 1]?.class;
  const drafted = useWatch<CharacterDefinition, "levels">({ name: "levels" }).at(-1)?.class;
  const sameClass =
    cls !== undefined && drafted !== undefined && entryKey(cls) === entryKey(drafted);
  // A new starting class owes its own picks, which nothing stamped for the old one stands for.
  const saved = sameClass
    ? {
        subclass: definition.levels
          .slice(0, level)
          .find((each) => entryKey(each.class) === entryKey(cls) && each.subclass)?.subclass,
        picks: definition.spells.filter((spell) => spell.pickedAt === level),
      }
    : undefined;
  const plan = useLevelUpPlan(before, undefined, saved);
  const starting = useStartingClassGrants(definition, drafted);
  const after = withReopenedLevel(definition, level, getValues());
  const later = useLaterPrerequisites(definition, after);
  const refusals = levelChoiceRefusals(definition, after, level, later.rows);
  const { departures, added: notes } = later.read
    ? later.departures
    : { departures: after.departures, added: [] };
  // A gain alone writes the choices as they stood, so it never waits on reading them.
  const choicesRead = [plan.picksReady, later.read, starting.read].every(Boolean);
  const waiting = formState.isDirty ? !choicesRead : !gainChanged;
  const blocked = waiting || saving || refusals.length > 0 || !starting.ready;
  return (
    <Modal onClose={cancel}>
      <ModalEntry
        title={`Edit level ${level}`}
        footer={
          <div className="flex w-full items-center gap-2">
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className={`${BUTTON} border border-error bg-surface text-error hover:bg-subtle`}
              >
                Remove level {level}
              </button>
            )}
            <LevelEditAlert
              error={error}
              onReload={onReload}
              lines={[
                ...(later.failed
                  ? ["Couldn't read the prerequisites of the other levels' picks."]
                  : []),
                ...(starting.failed
                  ? ["Couldn't read what the starting classes and the other sources grant."]
                  : []),
                ...refusals,
              ]}
            />
            <button
              type="button"
              onClick={cancel}
              className={`${BUTTON} border border-border bg-surface text-ink hover:bg-subtle`}
            >
              Cancel
            </button>
            <button
              type="submit"
              aria-disabled={blocked}
              onClick={(event) => {
                if (blocked) event.preventDefault();
                else {
                  setValue("departures", departures, { shouldDirty: true });
                  onSwap(starting.swap);
                }
              }}
              className={`${BUTTON} bg-accent text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
            >
              {saving ? "Saving…" : "Apply changes"}
            </button>
          </div>
        }
      >
        <section aria-labelledby={`${id}-hp`} className="flex flex-col gap-1.5">
          <h3 id={`${id}-hp`} className="font-semibold text-label text-muted uppercase">
            Hit points
          </h3>
          {hitPoints(plan.die)}
        </section>
        {level === 1 && drafted && (
          <StartingClassField
            edition={definition.edition}
            value={drafted}
            onChange={plan.setClass}
          />
        )}
        {!plan.target.read && <p className="text-muted">Loading the class…</p>}
        {asksNothing(plan) && <p className="text-muted">Level {level} asked for no choices.</p>}
        <LevelUpPicks edition={definition.edition} plan={plan} />
        <div aria-live="polite" className="text-row">
          {notes.length > 0 && (
            <>
              <p>A multiclass prerequisite is unmet, which Notes will list:</p>
              {notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </>
          )}
        </div>
        {level === 1 && starting.picks && drafted && (
          <StartingPicksFields name={displayName(drafted)} picks={starting.picks} />
        )}
        {level === 1 && (
          <p className="text-muted text-row">
            A new class leaves the spells the old one let you pick; change them from their list.
          </p>
        )}
      </ModalEntry>
    </Modal>
  );
}

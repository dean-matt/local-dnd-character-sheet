import {
  type CharacterDefinition,
  displayName,
  type EntryRef,
  entryKey,
  type HitDie,
} from "@dnd/character";
import { type ReactNode, useId } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { levelChoiceRefusals } from "../../../lib/levelChoices.ts";
import { Modal } from "../../Modal.tsx";
import { ModalEntry } from "../../ModalEntry.tsx";
import { ClassPicksFields } from "./ClassPicksFields.tsx";
import { ClassSpellsNote } from "./ClassSpellsNote.tsx";
import { ClassStatus } from "./ClassStatus.tsx";
import { LevelClassField } from "./LevelClassField.tsx";
import { LevelEditFooter } from "./LevelEditFooter.tsx";
import { LevelUpPicks } from "./LevelUpPicks.tsx";
import { type ClassSwap, withReopenedLevel } from "./reopenedLevel.ts";
import { UnmetPrerequisites } from "./UnmetPrerequisites.tsx";
import { useClassChangeGrants } from "./useClassChangeGrants.ts";
import { useLaterPrerequisites } from "./useLaterPrerequisites.ts";
import { useLevelUpPlan } from "./useLevelUpPlan.ts";

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
  /** Runs as Apply submits, with what a new class trades, which the write applies to the latest record, and the drafted class's die. */
  onApply: (applied: { swap: ClassSwap | undefined; die: HitDie | undefined }) => void;
  /** Runs as the class changes, which takes back any gain drafted for the old class's die. */
  onClass: () => void;
  /** The control that drafts this level's hit point gain, given the drafted class's die once it loads and whether the class changed. */
  hitPoints: (die: HitDie | undefined, classChanged: boolean) => ReactNode;
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

/** A reopened level's subclass and stamped spell picks, as saved; a new class owes its own, which nothing stamped for the old one stands for. */
function savedChoices(definition: CharacterDefinition, level: number) {
  const cls = definition.levels[level - 1]?.class;
  return {
    subclass: definition.levels
      .slice(0, level)
      .find((each) => cls && entryKey(each.class) === entryKey(cls) && each.subclass)?.subclass,
    picks: definition.spells.filter((spell) => spell.pickedAt === level),
  };
}

/**
 * A past level's hit point gain and picks inside the level-up form, and the Apply that writes
 * them once the gain or a pick changed. A changed pick also waits until every pick is made and
 * nothing that depends on it would be left behind; each such dependency is named instead. A multiclass
 * prerequisite the change leaves unmet is named and noted as a departure, as the level-up
 * notes one, and never refuses.
 * Every level also offers its class. A new one takes back the old one's skill and tool picks
 * and asks the new one's, level 1 for the starting class's and a later level for a multiclass
 * entry's, and Apply waits until they are made, then hands `onApply` what the old one granted
 * and what the new one grants. A later level's gain starts over on the new class's die.
 */
export function LevelEditForm({
  before,
  definition,
  level,
  saving,
  error,
  onReload,
  onApply,
  onClass,
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
  const saved = sameClass ? savedChoices(definition, level) : undefined;
  const plan = useLevelUpPlan(before, undefined, saved);
  const changed = cls !== undefined && drafted !== undefined && !sameClass;
  const starting = useClassChangeGrants(definition, level, drafted);
  const after = withReopenedLevel(definition, level, getValues());
  const later = useLaterPrerequisites(definition, after);
  const refusals = levelChoiceRefusals(definition, after, level, later.rows);
  const { departures, added: notes } = later.read
    ? later.departures
    : { departures: after.departures, added: [] };
  // A gain alone writes the choices as they stood, so it never waits on reading them.
  const choicesRead = [plan.picksReady, later.read, starting.read].every(Boolean);
  const waiting = formState.isDirty ? !choicesRead : !gainChanged;
  const noDie = changed && plan.target.read && plan.die === undefined;
  const blocked = waiting || saving || refusals.length > 0 || !starting.ready || noDie;
  const pickClass = (next: EntryRef) => {
    plan.setClass(next);
    // Back on the class the level holds, the level starts again as stored, gain and subclass included.
    if (cls && entryKey(next) === entryKey(cls))
      setValue("levels", definition.levels.slice(0, level), { shouldDirty: true });
    onClass();
  };
  return (
    <Modal onClose={cancel}>
      <ModalEntry
        title={`Edit level ${level}`}
        footer={
          <LevelEditFooter
            level={level}
            error={error}
            onReload={onReload}
            onRemove={onRemove}
            lines={[
              ...(later.failed
                ? ["Couldn't read the prerequisites of the other levels' picks."]
                : []),
              ...(starting.failed
                ? ["Couldn't read what the starting classes and the other sources grant."]
                : []),
              ...refusals,
            ]}
            blocked={blocked}
            saving={saving}
            cancel={cancel}
            onSubmit={() => {
              setValue("departures", departures, { shouldDirty: true });
              onApply({ swap: starting.swap, die: plan.die });
            }}
          />
        }
      >
        <section aria-labelledby={`${id}-hp`} className="flex flex-col gap-1.5">
          <h3 id={`${id}-hp`} className="font-semibold text-label text-muted uppercase">
            Hit points
          </h3>
          {hitPoints(plan.die, changed)}
        </section>
        {drafted && (
          <LevelClassField
            edition={definition.edition}
            level={level}
            value={drafted}
            onChange={pickClass}
          />
        )}
        <ClassStatus
          loading={!plan.target.read}
          noDie={
            noDie
              ? `${plan.target.name} has no hit die the sheet can read, so it cannot take level ${level}.`
              : undefined
          }
        />
        {asksNothing(plan) && <p className="text-muted">Level {level} asked for no choices.</p>}
        <LevelUpPicks edition={definition.edition} plan={plan} />
        <UnmetPrerequisites notes={notes} />
        {starting.picks && drafted && (
          <ClassPicksFields name={displayName(drafted)} picks={starting.picks} />
        )}
        {(level === 1 || changed) && <ClassSpellsNote />}
      </ModalEntry>
    </Modal>
  );
}

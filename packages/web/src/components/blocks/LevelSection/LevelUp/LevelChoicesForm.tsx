import { type CharacterDefinition, entryKey } from "@dnd/character";
import { useFormContext } from "react-hook-form";
import { levelChoiceRefusals } from "../../../../lib/levelChoices.ts";
import { Modal } from "../../../Modal.tsx";
import { ModalEntry } from "../../../ModalEntry.tsx";
import { LevelUpPicks } from "./LevelUpPicks.tsx";
import { withReopenedLevel } from "./reopenedLevel.ts";
import { useLaterPrerequisites } from "./useLaterPrerequisites.ts";
import { useLevelUpPlan } from "./useLevelUpPlan.ts";

const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-row";

export interface LevelChoicesFormProps {
  /** The definition before `level` chose anything, which the pickers read. */
  before: CharacterDefinition;
  /** The definition as the dialog opened on it. */
  definition: CharacterDefinition;
  level: number;
  saving: boolean;
  error: string | undefined;
  /** Offered beside `error` where reading the character again is the way past it. */
  onReload?: () => void;
  cancel: () => void;
}

/**
 * A past level's picks inside the level-up form, and the Apply that writes them once one
 * changed, every one is made, and nothing that depends on a changed pick would be left
 * behind; each such dependency is named instead. A multiclass prerequisite the change leaves
 * unmet is named and noted as a departure, as the level-up notes one, and never refuses.
 * The class and hit points are not offered.
 */
export function LevelChoicesForm({
  before,
  definition,
  level,
  saving,
  error,
  onReload,
  cancel,
}: LevelChoicesFormProps) {
  const { getValues, setValue, formState } = useFormContext<CharacterDefinition>();
  const cls = definition.levels[level - 1]?.class;
  const saved = {
    subclass: definition.levels
      .slice(0, level)
      .find((each) => cls && entryKey(each.class) === entryKey(cls) && each.subclass)?.subclass,
    picks: definition.spells.filter((spell) => spell.pickedAt === level),
  };
  const plan = useLevelUpPlan(before, undefined, saved);
  const later = useLaterPrerequisites(definition);
  const after = withReopenedLevel(definition, level, getValues());
  const refusals = levelChoiceRefusals(definition, after, level, later.rows);
  const { departures, added: notes } = later.read
    ? later.departures(after)
    : { departures: after.departures, added: [] };
  const blocked =
    !formState.isDirty || !plan.picksReady || !later.read || saving || refusals.length > 0;
  const { owed } = plan.spellPicks;
  const asksNothing =
    plan.target.read &&
    !plan.target.asksSubclass &&
    plan.grant === undefined &&
    plan.offerings.length === 0 &&
    plan.optionPicks.gains.length === 0 &&
    owed.cantrips + owed.spells + owed.subclassCantrips + owed.subclassSpells === 0;
  return (
    <Modal onClose={cancel}>
      <ModalEntry
        title={`Level ${level} choices`}
        footer={
          <div className="flex items-center gap-2">
            <div role="alert" className="text-error text-row">
              {error && (
                <p>
                  Couldn't save the choices: {error}
                  {onReload && (
                    <button
                      type="button"
                      onClick={onReload}
                      className="ml-2 font-semibold text-accent underline hover:text-accent-hover"
                    >
                      Reload
                    </button>
                  )}
                </p>
              )}
              {later.failed && <p>Couldn't read the prerequisites of the other levels' picks.</p>}
              {refusals.map((refusal) => (
                <p key={refusal}>{refusal}</p>
              ))}
            </div>
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
                else setValue("departures", departures, { shouldDirty: true });
              }}
              className={`${BUTTON} bg-accent text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
            >
              {saving ? "Saving…" : "Apply changes"}
            </button>
          </div>
        }
      >
        {!plan.target.read && <p className="text-muted">Loading the class…</p>}
        {asksNothing && <p className="text-muted">Level {level} asked for no choices.</p>}
        <LevelUpPicks edition={definition.edition} plan={plan} />
        <div aria-live="polite" className="text-row">
          {notes.length > 0 && (
            <>
              <p>Applying leaves a multiclass prerequisite unmet, which Notes will list:</p>
              {notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </>
          )}
        </div>
        <p className="text-muted text-row">
          Hit points change from the level's row; the class a level was taken in stays.
        </p>
      </ModalEntry>
    </Modal>
  );
}

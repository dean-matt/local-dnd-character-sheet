import { type CharacterDefinition, entryKey } from "@dnd/character";
import { useFormContext, useWatch } from "react-hook-form";
import { levelChoiceRefusals } from "../../../lib/levelChoices.ts";
import { swapGrants } from "../../../lib/proficiencyGrants.ts";
import { setRefValue } from "../../../lib/setRefValue.ts";
import { Modal } from "../../Modal.tsx";
import { ModalEntry } from "../../ModalEntry.tsx";
import { LevelUpPicks } from "./LevelUpPicks.tsx";
import { withReopenedLevel } from "./reopenedLevel.ts";
import { StartingClassField } from "./StartingClassField.tsx";
import { useLaterPrerequisites } from "./useLaterPrerequisites.ts";
import { useLevelUpPlan } from "./useLevelUpPlan.ts";
import { useStartingClassGrants } from "./useStartingClassGrants.ts";

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
 * Level 1 also offers its class: a new one takes back the old one's level 1 choices and asks
 * the new one's, and Apply swaps the proficiencies the old one granted outright for the new
 * one's. Hit points, and a later level's class, are not offered.
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
  const blocked =
    !formState.isDirty ||
    !plan.picksReady ||
    !later.read ||
    !starting.read ||
    saving ||
    refusals.length > 0;
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
              {starting.failed && (
                <p>Couldn't read what the starting classes and the other sources grant.</p>
              )}
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
                else {
                  setValue("departures", departures, { shouldDirty: true });
                  const { swap } = starting;
                  if (swap)
                    setRefValue(
                      setValue,
                      "proficiencies",
                      swapGrants(getValues("proficiencies"), swap.was, swap.now, swap.still),
                      { shouldDirty: true },
                    );
                }
              }}
              className={`${BUTTON} bg-accent text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
            >
              {saving ? "Saving…" : "Apply changes"}
            </button>
          </div>
        }
      >
        {level === 1 && drafted && (
          <StartingClassField
            edition={definition.edition}
            value={drafted}
            onChange={plan.setClass}
          />
        )}
        {!plan.target.read && <p className="text-muted">Loading the class…</p>}
        {asksNothing && <p className="text-muted">Level {level} asked for no choices.</p>}
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
        <p className="text-muted text-row">
          {level === 1
            ? "Hit points change from the level's Edit dialog. A new class leaves the skills and spells the old one let you pick; change them from their lists."
            : "Hit points change from the level's Edit dialog; the class a level was taken in stays."}
        </p>
      </ModalEntry>
    </Modal>
  );
}

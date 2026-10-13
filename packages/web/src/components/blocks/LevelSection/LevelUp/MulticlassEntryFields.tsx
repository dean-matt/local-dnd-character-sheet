import { refKey } from "@dnd/character";
import { useId } from "react";
import { prerequisiteText } from "../../../../lib/multiclassPrerequisites.ts";
import { EntryPickField } from "./EntryPickField.tsx";
import type { useLevelUpPlan } from "./useLevelUpPlan.ts";

/**
 * What a level in a class the character does not hold yet asks and brings: each class's
 * multiclass prerequisite against the stored scores, reported and never enforced, since a
 * table may waive it; the proficiencies the class grants on entry; and a checkbox list for
 * each skill or tool pick it offers.
 */
export function MulticlassEntryFields({
  name,
  plan,
}: {
  name: string;
  plan: ReturnType<typeof useLevelUpPlan>;
}) {
  const headingId = useId();
  const { entry, pickedSkills, pickedTools } = plan;
  const binding = entry.prerequisites.filter((each) => (each.prerequisite ?? []).length > 0);
  const { armor, weapons, tools } = entry.granted;
  const granted = [...armor, ...weapons, ...tools.map((tool) => tool.name)];
  return (
    <>
      {binding.length > 0 && (
        <section aria-labelledby={headingId} className="flex flex-col gap-1">
          <h3 id={headingId} className="font-semibold text-label text-muted uppercase">
            Multiclass prerequisites
          </h3>
          <ul className="flex flex-col gap-0.5 text-row">
            {binding.map((each) => (
              <li key={each.firstIndex}>
                {each.name} needs {prerequisiteText(each.prerequisite ?? [])}:{" "}
                <span className={each.met ? "text-muted" : "font-semibold text-error"}>
                  {each.met ? "met" : "not met"}
                </span>
              </li>
            ))}
          </ul>
          {binding.some((each) => !each.met) && (
            <p className="text-muted text-row">
              The level can still be taken, and Notes lists each prerequisite it leaves unmet.
            </p>
          )}
        </section>
      )}
      <p className="text-row">
        {granted.length > 0
          ? `Multiclassing into ${name} grants: ${granted.join(", ")}`
          : `Multiclassing into ${name} grants no proficiencies.`}
      </p>
      {entry.failed ? (
        <p role="alert" className="text-error">
          Couldn't load what multiclassing into {name} offers, so the level cannot be applied. Close
          the dialog and try again.
        </p>
      ) : (
        !entry.read && <p className="text-muted">Loading what the class offers…</p>
      )}
      {entry.read && entry.skillPick && (
        <EntryPickField
          legend={`Skill from ${name}`}
          count={entry.skillPick.count}
          options={entry.skillPick.options.map((ref) => ({ key: refKey(ref), label: ref.name }))}
          picked={new Set(pickedSkills.map(refKey))}
          onToggle={(key) => {
            const ref = entry.skillPick?.options.find((each) => refKey(each) === key);
            if (ref) plan.toggleSkill(ref);
          }}
        />
      )}
      {entry.read &&
        entry.toolPicks.map((pick, index) => (
          <EntryPickField
            // biome-ignore lint/suspicious/noArrayIndexKey: a class's picks never reorder.
            key={index}
            legend={`Tool from ${name}`}
            count={pick.count}
            options={pick.options.map((tool) => ({ key: tool, label: tool }))}
            picked={new Set(pickedTools[index])}
            onToggle={plan.toggleTool}
          />
        ))}
    </>
  );
}

import type { CharacterDerived } from "@dnd/character";
import { Field } from "../../../Field/Field.tsx";
import { AbsentValue } from "./AbsentValue.tsx";

/** The three passive scores a table asks for, looked up by the skill's name in either edition. */
const PASSIVE_SKILLS = ["Perception", "Insight", "Investigation"];

/** Passive Perception first, since it is the one a table asks for; the others follow in its footer. */
export function PassiveScores({ derived }: { derived: CharacterDerived }) {
  return (
    <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-border border-t pt-2 text-muted text-row">
      {PASSIVE_SKILLS.map((name) => {
        const skill = derived.skills.find((candidate) => candidate.ref.name === name);
        return (
          <div key={name} className="flex items-baseline gap-1">
            <dt>Passive {name}</dt>
            <dd className="font-semibold text-ink">
              {skill ? (
                <Field
                  mode="read"
                  label="score"
                  labelHidden
                  value={skill.passive}
                  format={String}
                />
              ) : (
                <AbsentValue />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

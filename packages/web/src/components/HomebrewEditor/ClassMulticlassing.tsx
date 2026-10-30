import { ABILITIES, ABILITY_LABEL } from "@dnd/character";
import { InputField } from "../InputField.tsx";
import { ClassProficiencies } from "./ClassProficiencies.tsx";
import {
  CLASS_SKILL_SPEC,
  proficienciesIn,
  readRequirements,
  requirementProblem,
  withMulticlassing,
  writeRequirements,
} from "./classShapes.ts";
import { grantProblem } from "./featGrantShapes.ts";
import { type HomebrewFormProps, typedInteger } from "./homebrewEntry.ts";
import { FORM_GRID, SHORT, WHOLE } from "./homebrewGrid.ts";

/**
 * What a homebrew class needs of a character who multiclasses into it, and what it gives them:
 * a minimum score per ability, all of which they must meet, and the proficiencies gained.
 */
export function ClassMulticlassing(props: HomebrewFormProps) {
  const { entry, onChange, errorFor } = props;
  const minimums = readRequirements(entry.multiclassing);
  const problem = errorFor("multiclassing");
  const shown = typeof problem === "string" ? problem : undefined;
  const own = (problem: string | undefined) => (problem && shown === problem ? shown : undefined);
  const minimumProblem = requirementProblem(entry.multiclassing);
  const skills = proficienciesIn(entry, true)?.skills;
  return (
    <div className="flex flex-col gap-4">
      {minimums ? (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1 font-semibold text-row">Minimum scores</legend>
          <div className={FORM_GRID}>
            {ABILITIES.map((ability) => (
              <div key={ability} className={SHORT}>
                <InputField
                  label={`${ABILITY_LABEL[ability]} minimum`}
                  type="number"
                  min={1}
                  max={30}
                  step={1}
                  value={minimums[ability] ?? ""}
                  error={
                    minimumProblem?.startsWith(ability.toUpperCase())
                      ? own(minimumProblem)
                      : undefined
                  }
                  onChange={(event) =>
                    onChange(
                      withMulticlassing(
                        entry,
                        "requirements",
                        writeRequirements({
                          ...minimums,
                          [ability]: typedInteger(event.target.value) ?? null,
                        }),
                      ),
                    )
                  }
                />
              </div>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className={`${WHOLE} text-muted text-row`}>
          This class states its multiclassing requirements as alternatives. Edit them in JSON.
        </p>
      )}
      <ClassProficiencies
        {...props}
        gained
        skillsError={own(grantProblem(skills, CLASS_SKILL_SPEC))}
      />
    </div>
  );
}

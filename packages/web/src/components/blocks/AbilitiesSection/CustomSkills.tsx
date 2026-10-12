import {
  ABILITIES,
  type Ability,
  type CharacterDefinition,
  type CharacterDerived,
  type CharacterRecord,
  derivedValue,
  effectsOnRoll,
} from "@dnd/character";
import { type FormEvent, useState } from "react";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { FormField } from "../../FormField.tsx";
import { InputField } from "../../InputField.tsx";
import { SaveFailure } from "../../SaveFailure.tsx";
import { Select } from "../../Select.tsx";
import { ProficiencyRow } from "./ProficiencyRow.tsx";
import type { ProficiencyLevel } from "./proficiencyMark.ts";

type CustomSkill = CharacterDefinition["customSkills"][number];

/** Half proficiency comes from a feature rather than a pick, so the ring skips it and a stored half moves on to none. */
const LEVEL_CYCLE: ProficiencyLevel[] = ["none", "proficient", "expertise"];

const nextLevel = (level: ProficiencyLevel) =>
  LEVEL_CYCLE[(LEVEL_CYCLE.indexOf(level) + 1) % LEVEL_CYCLE.length] ?? "none";

const ABILITY_OPTIONS = ABILITIES.map((ability) => ({
  value: ability,
  label: ability.toUpperCase(),
}));

/**
 * The skills a character adds beyond the catalog's, each change saved at once as an undo
 * entry. A name a catalog skill or another custom skill already holds is refused here,
 * since only the sheet holds the edition's skill list.
 */
export function CustomSkills({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const update = useUpdateCharacterDefinition(character.id);
  const [name, setName] = useState("");
  const [ability, setAbility] = useState<Ability>("str");
  const [refusal, setRefusal] = useState<string>();
  const rollEffects = derivedValue(derived.rollEffects);
  const stored = character.definition.customSkills;

  const save = (customSkills: (skills: CustomSkill[]) => CustomSkill[]) =>
    update.mutate((latest) => ({ ...latest, customSkills: customSkills(latest.customSkills) }));

  function add(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === "") return;
    const taken = (other: string) => other.toLowerCase() === trimmed.toLowerCase();
    const builtIn = derived.skills.find((skill) => taken(skill.ref.name));
    if (builtIn) return setRefusal(`${builtIn.ref.name} is already a skill.`);
    const custom = stored.find((skill) => taken(skill.name));
    if (custom) return setRefusal(`${custom.name} is already a custom skill.`);
    setRefusal(undefined);
    setName("");
    save((skills) => [...skills, { name: trimmed, ability, level: "none" }]);
  }

  return (
    <>
      {derived.customSkills.length > 0 && (
        <ul aria-label="Custom skills" className="mt-1 grid gap-x-5 gap-y-1 sm:grid-cols-2">
          {derived.customSkills.map((skill) => {
            const level = stored.find((each) => each.name === skill.name)?.level ?? "none";
            return (
              <ProficiencyRow
                key={skill.name}
                level={level}
                name={skill.name}
                ability={skill.ability}
                modifier={skill.modifier}
                title={skill.name}
                rules={undefined}
                effects={effectsOnRoll(rollEffects, {
                  roll: "skill",
                  skill: skill.name,
                  ability: skill.ability,
                })}
                onCycleLevel={() =>
                  save((skills) =>
                    skills.map((each) =>
                      each.name === skill.name ? { ...each, level: nextLevel(each.level) } : each,
                    ),
                  )
                }
                onRemove={() => save((skills) => skills.filter((each) => each.name !== skill.name))}
              />
            );
          })}
        </ul>
      )}
      <form noValidate onSubmit={add} className="mt-2 flex items-start gap-1.5">
        <div className="min-w-0 grow">
          <InputField
            label="Custom skill"
            labelHidden
            placeholder="Custom skill"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setRefusal(undefined);
            }}
            error={refusal}
          />
        </div>
        <FormField label="New skill ability" labelHidden>
          {(control) => (
            <Select
              {...control}
              options={ABILITY_OPTIONS}
              value={ability}
              onChange={(next) => setAbility(next as Ability)}
            />
          )}
        </FormField>
        <button
          type="submit"
          className="control shrink-0 border-accent bg-accent font-semibold text-white hover:bg-accent-hover"
        >
          Add
        </button>
      </form>
      {update.isError && (
        <p role="alert" className="mt-1 flex items-center gap-2 text-error text-row">
          <SaveFailure
            message={`Couldn't save the custom skills: ${update.error.message}`}
            onRetry={() => update.variables && update.mutate(update.variables)}
          />
        </p>
      )}
    </>
  );
}

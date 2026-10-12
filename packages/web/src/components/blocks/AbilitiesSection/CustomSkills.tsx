import {
  ABILITIES,
  type Ability,
  type CharacterDefinition,
  type CharacterDerived,
  type CharacterRecord,
  derivedValue,
  effectsOnRoll,
} from "@dnd/character";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { FormField } from "../../FormField.tsx";
import { InputField } from "../../InputField.tsx";
import { SaveFailure } from "../../SaveFailure.tsx";
import { Select } from "../../Select.tsx";
import { FlatSkillBase } from "./FlatSkillBase.tsx";
import { ProficiencyRow } from "./ProficiencyRow.tsx";
import { nextLevel } from "./proficiencyMark.ts";
import { RemoveCustomSkill } from "./RemoveCustomSkill.tsx";

type CustomSkill = CharacterDefinition["customSkills"][number];

type Base = Ability | "flat";

const BASE_OPTIONS = [
  ...ABILITIES.map((ability) => ({ value: ability, label: ability.toUpperCase() })),
  { value: "flat", label: "Flat bonus" },
];

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
  const [base, setBase] = useState<Base>("str");
  const [refusal, setRefusal] = useState<string>();
  const rollEffects = derivedValue(derived.rollEffects);
  const stored = character.definition.customSkills;

  const save = (customSkills: (skills: CustomSkill[]) => CustomSkill[]) =>
    update.mutate((latest) => ({ ...latest, customSkills: customSkills(latest.customSkills) }));

  const addField = useRef<HTMLInputElement>(null);
  const [removed, setRemoved] = useState<string>();

  // Waits for the render that drops the row: until then its modal holds the page inert.
  useEffect(() => {
    if (removed === undefined || stored.some((each) => each.name === removed)) return;
    setRemoved(undefined);
    addField.current?.focus();
  }, [removed, stored]);

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
    const skill: CustomSkill =
      base === "flat"
        ? { name: trimmed, flat: 0, level: "none" }
        : { name: trimmed, ability: base, level: "none" };
    save((skills) => [...skills, skill]);
  }

  return (
    <>
      {derived.customSkills.length > 0 && (
        <ul aria-label="Custom skills" className="mt-1 grid gap-x-5 gap-y-1 sm:grid-cols-2">
          {derived.customSkills.map((skill) => {
            const own = stored.find((each) => each.name === skill.name);
            // The stored list drops a removed skill before the derived block refetches.
            if (!own) return null;
            const level = own.level;
            return (
              <ProficiencyRow
                key={skill.name}
                level={level}
                name={skill.name}
                ability={skill.ability ?? "flat"}
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
                detailFooter={
                  <div className="flex flex-1 items-start justify-between gap-3">
                    {"flat" in own && (
                      <FlatSkillBase characterId={character.id} name={skill.name} flat={own.flat} />
                    )}
                    <RemoveCustomSkill
                      characterId={character.id}
                      name={skill.name}
                      onRemoved={() => setRemoved(skill.name)}
                    />
                  </div>
                }
              />
            );
          })}
        </ul>
      )}
      <form noValidate onSubmit={add} className="mt-2 flex items-start gap-1.5">
        <div className="min-w-0 grow">
          <InputField
            ref={addField}
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
        <FormField label="New skill base" labelHidden>
          {(control) => (
            <Select
              {...control}
              options={BASE_OPTIONS}
              value={base}
              onChange={(next) => setBase(next as Base)}
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

import { HOMEBREW_SOURCE, homebrewSkillRecordSchema } from "@dnd/catalog";
import { type CharacterRecord, refKey } from "@dnd/character";
import { useState } from "react";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { useHomebrew } from "../../../hooks/useHomebrew.ts";
import { FormField } from "../../FormField.tsx";
import { Select } from "../../Select.tsx";

/**
 * Adds a homebrew skill of the character's edition to its skill list, citing it by
 * `(name, source)` at no proficiency. Offers nothing, and draws nothing, once the character
 * holds every one the table has defined.
 */
export function AddHomebrewSkill({ character }: { character: CharacterRecord }) {
  const write = useHeldSave(character.id, "Homebrew skills");
  const skills = useHomebrew("skills", homebrewSkillRecordSchema).list.data;
  const [chosen, setChosen] = useState("");
  const held = new Set(character.definition.proficiencies.skills.map(({ ref }) => refKey(ref)));
  const options = (skills ?? [])
    .filter(
      ({ name, edition }) =>
        edition === character.edition && !held.has(refKey({ name, source: HOMEBREW_SOURCE })),
    )
    .map(({ name }) => ({ value: name, label: name }));
  if (options.length === 0) return null;

  function add() {
    if (chosen === "") return;
    setChosen("");
    write(chosen.toLowerCase(), (latest) => ({
      ...latest,
      proficiencies: {
        ...latest.proficiencies,
        skills: [
          ...latest.proficiencies.skills,
          { ref: { name: chosen, source: HOMEBREW_SOURCE }, level: "none" },
        ],
      },
    }));
  }

  return (
    <div className="mt-2 flex items-start gap-1.5">
      <FormField label="Homebrew skill" labelHidden>
        {(control) => (
          <Select
            {...control}
            options={[{ value: "", label: "Homebrew skill" }, ...options]}
            value={chosen}
            onChange={setChosen}
          />
        )}
      </FormField>
      <button
        type="button"
        onClick={add}
        className="control shrink-0 border-accent bg-accent font-semibold text-white hover:bg-accent-hover"
      >
        Add homebrew skill
      </button>
    </div>
  );
}

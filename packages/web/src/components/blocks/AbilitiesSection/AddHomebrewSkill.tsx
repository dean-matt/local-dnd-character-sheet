import { HOMEBREW_SOURCE, type HomebrewSkillRecord, homebrewSkillRecordSchema } from "@dnd/catalog";
import { type CharacterRecord, refKey } from "@dnd/character";
import { type RefObject, useState } from "react";
import { useHomebrew } from "../../../hooks/useHomebrew.ts";
import { useSaveToast } from "../../../hooks/useSaveToast.ts";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { FormField } from "../../FormField.tsx";
import { Select } from "../../Select.tsx";

/**
 * Adds a homebrew skill of the character's edition to its skill list, citing it by
 * `(name, source)` at no proficiency, with a flat number of 0 for a flat one. Offers nothing,
 * and draws nothing, once the character holds every one the table has defined; `nameField`
 * then takes focus, so it is not lost with the picker.
 */
export function AddHomebrewSkill({
  character,
  nameField,
  onAdded,
}: {
  character: CharacterRecord;
  nameField: RefObject<HTMLInputElement | null>;
  onAdded: (name: string) => void;
}) {
  const update = useUpdateCharacterDefinition(character.id);
  const skills = useHomebrew("skills", homebrewSkillRecordSchema).list.data;
  const [chosen, setChosen] = useState("");
  const [failure, setFailure] = useState<{ error: Error; retry: () => void }>();
  useSaveToast(
    "Homebrew skills",
    failure ? `Couldn't save: ${failure.error.message}` : undefined,
    failure?.retry,
    failure?.error,
  );
  const held = new Set(character.definition.proficiencies.skills.map(({ ref }) => refKey(ref)));
  const open = (skills ?? []).filter(
    ({ name, edition }) =>
      edition === character.edition && !held.has(refKey({ name, source: HOMEBREW_SOURCE })),
  );
  if (open.length === 0) return null;

  function hold(record: HomebrewSkillRecord, remaining: number) {
    update
      .mutateAsync((latest) => ({
        ...latest,
        proficiencies: {
          ...latest.proficiencies,
          skills: [
            ...latest.proficiencies.skills,
            {
              ref: { name: record.name, source: HOMEBREW_SOURCE },
              level: "none" as const,
              ...(record.json.ability === "flat" && { flat: 0 }),
            },
          ],
        },
      }))
      .then(
        () => {
          setFailure(undefined);
          onAdded(record.name);
          if (remaining === 0) nameField.current?.focus();
        },
        (error: Error) => setFailure({ error, retry: () => hold(record, remaining) }),
      );
  }

  function add() {
    const record = open.find(({ name }) => name === chosen);
    if (!record) return;
    setChosen("");
    hold(record, open.length - 1);
  }

  return (
    <div className="mt-2 flex items-start gap-1.5">
      <FormField label="Homebrew skill" labelHidden>
        {(control) => (
          <Select
            {...control}
            options={[
              { value: "", label: "Homebrew skill" },
              ...open.map(({ name }) => ({ value: name, label: name })),
            ]}
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

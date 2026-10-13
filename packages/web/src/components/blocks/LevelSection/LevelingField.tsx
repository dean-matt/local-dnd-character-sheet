import type { CharacterDefinition, CharacterRecord } from "@dnd/character";
import { useState } from "react";
import { useHeldWriteError } from "../../../hooks/useHeldWriteError.ts";
import { useSaveToast } from "../../../hooks/useSaveToast.ts";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { FormField } from "../../FormField.tsx";
import { Select } from "../../Select.tsx";

type Leveling = CharacterDefinition["leveling"];

const OPTIONS: { value: Leveling; label: string }[] = [
  { value: "xp", label: "Experience" },
  { value: "milestone", label: "Milestone" },
];

/** The leveling mode, saved as soon as it is picked. */
export function LevelingField({ character }: { character: CharacterRecord }) {
  const update = useUpdateCharacterDefinition(character.id);
  const failure = useHeldWriteError(update);
  const current = character.definition.leveling;
  const [picked, setPicked] = useState<Leveling>();

  function save(leveling: Leveling) {
    setPicked(leveling);
    update.mutate((latest) => ({ ...latest, leveling }));
  }

  useSaveToast(
    "Leveling",
    failure
      ? `Couldn't save ${OPTIONS.find((option) => option.value === picked)?.label}: ${failure.message}`
      : undefined,
    () => picked && save(picked),
    failure,
  );

  return (
    <FormField label="Leveling" invalid={failure !== null}>
      {(control) => (
        <Select
          {...control}
          options={OPTIONS}
          value={current}
          onChange={(next) => save(next as Leveling)}
        />
      )}
    </FormField>
  );
}

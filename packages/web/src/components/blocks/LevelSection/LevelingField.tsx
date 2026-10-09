import type { CharacterDefinition, CharacterRecord } from "@dnd/character";
import { useState } from "react";
import { useFleeting } from "../../../hooks/useFleeting.ts";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { FormField } from "../../FormField.tsx";
import { SaveFailure } from "../../SaveFailure.tsx";
import { Select } from "../../Select.tsx";

type Leveling = CharacterDefinition["leveling"];

const OPTIONS: { value: Leveling; label: string }[] = [
  { value: "xp", label: "Experience" },
  { value: "milestone", label: "Milestone" },
];

/** The leveling mode, saved as soon as it is picked. */
export function LevelingField({ character }: { character: CharacterRecord }) {
  const update = useUpdateCharacterDefinition(character.id);
  const current = character.definition.leveling;
  const [picked, setPicked] = useState<Leveling>();
  const showSaved = useFleeting(update.isSuccess && picked === current);

  function save(leveling: Leveling) {
    setPicked(leveling);
    update.mutate((latest) => ({ ...latest, leveling }));
  }

  return (
    <FormField
      label="Leveling"
      status={update.isPending ? "Saving…" : showSaved ? "Saved" : null}
      error={
        update.isError && (
          <SaveFailure
            message={`Couldn't save ${OPTIONS.find((option) => option.value === picked)?.label}: ${update.error.message}`}
            onRetry={() => picked && save(picked)}
          />
        )
      }
    >
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

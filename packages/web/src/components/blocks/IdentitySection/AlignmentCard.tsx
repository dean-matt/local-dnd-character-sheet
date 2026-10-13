import type { CharacterRecord } from "@dnd/character";
import { useState } from "react";
import { useHeldWriteError } from "../../../hooks/useHeldWriteError.ts";
import { useSaveToast } from "../../../hooks/useSaveToast.ts";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { alignmentOptions } from "../../../lib/alignments.ts";
import { Card } from "../../Card.tsx";
import { FormField } from "../../FormField.tsx";
import { Select } from "../../Select.tsx";

/** Alignment picked from the nine, saved as soon as it is picked; None drops the key. */
export function AlignmentCard({ character }: { character: CharacterRecord }) {
  const update = useUpdateCharacterDefinition(character.id);
  const failure = useHeldWriteError(update);
  // The last pick, which Retry writes again.
  const [picked, setPicked] = useState<string>();

  const current = character.definition.alignment ?? "";
  const options = alignmentOptions(current);

  function save(alignment: string) {
    setPicked(alignment);
    update.mutate(({ alignment: _cleared, ...latest }) =>
      alignment === "" ? latest : { ...latest, alignment },
    );
  }

  useSaveToast(
    "Alignment",
    // The button shows the stored value again, so the message names the pick.
    failure
      ? `Couldn't save ${options.find((option) => option.value === picked)?.label ?? picked}: ${failure.message}`
      : undefined,
    () => save(picked ?? ""),
  );

  return (
    <Card title="Alignment">
      <FormField label="Alignment" labelHidden invalid={failure !== null}>
        {(control) => <Select {...control} options={options} value={current} onChange={save} />}
      </FormField>
    </Card>
  );
}

import type { CharacterRecord } from "@dnd/character";
import { useState } from "react";
import { useFleeting } from "../../hooks/useFleeting.ts";
import { useUpdateCharacterDefinition } from "../../hooks/useUpdateCharacterDefinition.ts";
import { alignmentOptions } from "../../lib/alignments.ts";
import { Card } from "../Card.tsx";
import { FormField } from "../FormField.tsx";
import { SaveFailure } from "../SaveFailure.tsx";
import { Select } from "../Select.tsx";
import { SectionUnavailable } from "./SectionUnavailable.tsx";

/** Alignment picked from the nine, saved as soon as it is picked; None drops the key. */
export function AlignmentSection({ character }: { character: CharacterRecord | undefined }) {
  const update = useUpdateCharacterDefinition(character?.id ?? "");
  // The last pick, which Retry writes again; "Saved" shows only while it is the value shown,
  // so an undo after a save clears it.
  const [picked, setPicked] = useState<string>();
  const showSaved = useFleeting(
    update.isSuccess && picked === (character?.definition.alignment ?? ""),
  );
  if (!character) return <SectionUnavailable page="Alignment" />;

  const current = character.definition.alignment ?? "";
  const options = alignmentOptions(current);

  function save(alignment: string) {
    setPicked(alignment);
    update.mutate(({ alignment: _cleared, ...latest }) =>
      alignment === "" ? latest : { ...latest, alignment },
    );
  }

  return (
    <Card title="Alignment">
      <FormField
        label="Alignment"
        labelHidden
        status={update.isPending ? "Saving…" : showSaved ? "Saved" : null}
        error={
          update.isError && (
            <SaveFailure
              // The button shows the stored value again, so the message names the pick.
              message={`Couldn't save ${options.find((option) => option.value === picked)?.label ?? picked}: ${update.error.message}`}
              onRetry={() => save(picked ?? "")}
            />
          )
        }
      >
        {(control) => <Select {...control} options={options} value={current} onChange={save} />}
      </FormField>
    </Card>
  );
}

import type { SheetFeature } from "@dnd/catalog";
import { type CharacterRecord, refKey } from "@dnd/character";
import { useState } from "react";
import { useDisabledSources } from "../../../hooks/useDisabledSources.ts";
import { useHeldWriteError } from "../../../hooks/useHeldWriteError.ts";
import { useSaveToast } from "../../../hooks/useSaveToast.ts";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { shownOptions, takenOption, withFeatureChoice } from "../../../lib/featureChoices.ts";
import { FormField } from "../../FormField.tsx";
import { Select } from "../../Select.tsx";

type Choice = NonNullable<SheetFeature["choice"]>;

/**
 * The option taken from a feature that offers a choice of features — `Bear` from `Totem
 * Spirit` (PHB) — saved as soon as it is picked, each change an undo entry. An option from
 * a source the reader turned off stays hidden unless it is the one taken.
 */
export function FeatureChoiceField({
  character,
  choice,
}: {
  character: CharacterRecord;
  choice: Choice;
}) {
  const update = useUpdateCharacterDefinition(character.id);
  const failure = useHeldWriteError(update);
  const disabled = useDisabledSources();
  const [picked, setPicked] = useState<string>();
  const current = takenOption(character.definition.featureChoices, choice.feature, choice.options);
  const shown = shownOptions(choice.options, current, disabled);

  function save(key: string) {
    const option = choice.options.find((each) => refKey(each) === key);
    if (!option) return;
    setPicked(key);
    update.mutate((latest) => ({
      ...latest,
      featureChoices: withFeatureChoice(latest.featureChoices, choice.feature, [option]),
    }));
  }

  useSaveToast(
    choice.feature.name,
    failure
      ? `Couldn't save ${choice.options.find((each) => refKey(each) === picked)?.name}: ${failure.message}`
      : undefined,
    () => picked && save(picked),
  );

  return (
    <FormField label={`${choice.feature.name} choice`} labelHidden invalid={failure !== null}>
      {(control) => (
        <Select
          {...control}
          options={shown.map((option) => ({ value: refKey(option), label: option.name }))}
          value={current ? refKey(current) : "Choose one"}
          onChange={save}
        />
      )}
    </FormField>
  );
}

import type { SheetFeature } from "@dnd/catalog";
import { type CharacterRecord, refKey } from "@dnd/character";
import { useState } from "react";
import { useDisabledSources } from "../../../hooks/useDisabledSources.ts";
import { useFleeting } from "../../../hooks/useFleeting.ts";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { chosenOptions, withFeatureChoice } from "../../../lib/featureChoices.ts";
import { FormField } from "../../FormField.tsx";
import { SaveFailure } from "../../SaveFailure.tsx";
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
  const disabled = useDisabledSources();
  const [picked, setPicked] = useState<string>();
  const taken = chosenOptions(character.definition.featureChoices, choice.feature).map(refKey);
  const current = choice.options.find((option) => taken.includes(refKey(option)));
  const showSaved = useFleeting(update.isSuccess && picked !== undefined && picked === taken[0]);
  const shown = choice.options.filter(
    (option) => option === current || !disabled.includes(option.source),
  );

  function save(key: string) {
    const option = choice.options.find((each) => refKey(each) === key);
    if (!option) return;
    setPicked(key);
    update.mutate((latest) => ({
      ...latest,
      featureChoices: withFeatureChoice(latest.featureChoices, choice.feature, [option]),
    }));
  }

  return (
    <FormField
      label={`${choice.feature.name} choice`}
      labelHidden
      status={update.isPending ? "Saving…" : showSaved ? "Saved" : null}
      error={
        update.isError && (
          <SaveFailure
            message={`Couldn't save ${choice.options.find((each) => refKey(each) === picked)?.name}: ${update.error.message}`}
            onRetry={() => picked && save(picked)}
          />
        )
      }
    >
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

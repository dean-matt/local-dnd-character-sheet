import { type CharacterDefinition, featureKey, refKey } from "@dnd/character";
import { useFormContext, useWatch } from "react-hook-form";
import { useDisabledSources } from "../../hooks/useDisabledSources.ts";
import { shownOptions, takenOption, withFeatureChoice } from "../../lib/featureChoices.ts";
import { ChoicePills } from "./ChoicePills.tsx";
import type { FeatureOffering } from "./featureOfferings.ts";

/**
 * A choice for each feature a class or its subclass offers one from by the class's level —
 * `Totem Spirit` (PHB) offers five totems. An option from a source the reader turned off
 * stays hidden unless it is the one already taken.
 */
export function FeatureChoicesField({ offerings }: { offerings: readonly FeatureOffering[] }) {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const choices = useWatch<CharacterDefinition, "featureChoices">({ name: "featureChoices" });
  const disabled = useDisabledSources();
  return offerings.map(({ feature, options }) => {
    const chosen = takenOption(choices, feature, options);
    const shown = shownOptions(options, chosen, disabled);
    return (
      <ChoicePills
        key={featureKey(feature)}
        legend={feature.name}
        prompting={chosen === undefined}
        options={shown.map((option) => ({ value: refKey(option), label: option.name }))}
        value={chosen && refKey(chosen)}
        onChange={(value) => {
          const option = options.find((each) => refKey(each) === value);
          if (!option) return;
          setValue(
            "featureChoices",
            withFeatureChoice(getValues("featureChoices"), feature, [option]),
            { shouldDirty: true },
          );
        }}
      />
    );
  });
}

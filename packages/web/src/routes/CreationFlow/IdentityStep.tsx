import type { CharacterDefinition } from "@dnd/character";
import { useFormContext, useWatch } from "react-hook-form";
import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { Select } from "../../components/Select.tsx";
import { alignmentOptions } from "../../lib/alignments.ts";
import { BackgroundField } from "./BackgroundField.tsx";
import { creationForm } from "./creationForm.ts";
import { DeityField } from "./DeityField.tsx";
import { RaceField } from "./RaceField.tsx";

/** Who the character is: name and race on the left, background, alignment and deity on the right. */
export function IdentityStep() {
  const { setValue } = useFormContext<CharacterDefinition>();
  const alignment = useWatch<CharacterDefinition, "alignment">({ name: "alignment" }) ?? "";
  const name = creationForm.useField("name");
  return (
    <div className="grid gap-7 sm:grid-cols-2">
      <div className="flex flex-col gap-4">
        <InputField label="Name" placeholder="Character name…" {...name} />
        <RaceField />
      </div>
      <div className="flex flex-col gap-4">
        <BackgroundField />
        <FormField label="Alignment">
          {(control) => (
            <Select
              {...control}
              options={alignmentOptions(alignment)}
              value={alignment}
              onChange={(value) =>
                setValue("alignment", value === "" ? undefined : value, { shouldDirty: true })
              }
            />
          )}
        </FormField>
        <DeityField />
      </div>
    </div>
  );
}

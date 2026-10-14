import { type CharacterDerived, characterDerivedSchema, derivedValue } from "@dnd/character";
import { useContext } from "react";
import { capitalize } from "../../../lib/capitalize.ts";
import { dropSaveToast, raiseSaveToast } from "../../../lib/saveToasts.ts";
import { Field } from "../../Field/Field.tsx";
import { FormField } from "../../FormField.tsx";
import { SaveOverride } from "../../overrideContext.ts";
import { Popover } from "../../Popover.tsx";
import { Select } from "../../Select.tsx";

const SIZES = characterDerivedSchema.shape.size.shape.computed.options;
const TOAST_ID = "size-override";

/**
 * The race's size and, on the character page, a pick that overrides it. Picking the
 * computed size drops the override rather than storing a copy of it. Like an ability score
 * override, it shows here and moves nothing else: carrying capacity reads the race's size.
 */
export function SizeValue({ size }: { size: CharacterDerived["size"] }) {
  const save = useContext(SaveOverride);
  const trigger = <Field mode="read" label="" labelHidden value={size} format={capitalize} />;
  if (save === null && size.manual === null) return trigger;
  // A pick has no text to keep outlined, so a failed write raises its toast here.
  const pick = (next: string) => {
    save?.("size", next === size.computed ? null : next).then(
      () => dropSaveToast(TOAST_ID),
      (error: unknown) =>
        raiseSaveToast({
          id: TOAST_ID,
          field: "Size",
          message: error instanceof Error ? error.message : "Save failed.",
          retry: () => pick(next),
        }),
    );
  };
  return (
    <Popover
      trigger={trigger}
      triggerLabel={`Size ${capitalize(derivedValue(size))}${
        size.manual === null ? "" : `, overridden from ${capitalize(size.computed)}`
      }`}
      label="Size breakdown"
    >
      <div className="flex flex-col gap-1.5">
        {size.manual !== null && (
          <p>
            Overridden from {capitalize(size.computed)}.
            {save !== null && ` Pick ${capitalize(size.computed)} again to drop the override.`}
          </p>
        )}
        {save !== null && (
          <FormField label="Size override" labelHidden>
            {(control) => (
              <Select
                {...control}
                value={derivedValue(size)}
                options={SIZES.map((option) => ({
                  value: option,
                  label:
                    option === size.computed
                      ? `${capitalize(option)} (computed)`
                      : capitalize(option),
                }))}
                onChange={pick}
              />
            )}
          </FormField>
        )}
      </div>
    </Popover>
  );
}

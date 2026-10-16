import { type ReactNode, useState } from "react";
import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { Select } from "../../components/Select.tsx";

const OPTIONS = [
  { value: "", label: "Not required" },
  { value: "required", label: "Required" },
  { value: "optional", label: "Optional" },
  { value: "by", label: "Required by…" },
];

type Choice = "" | "required" | "optional" | "by";

const choiceOf = (reqAttune: unknown): Choice => {
  if (reqAttune === true) return "required";
  if (reqAttune === "optional") return "optional";
  return typeof reqAttune === "string" && reqAttune !== "" ? "by" : "";
};

export interface ItemAttunementFieldProps {
  /** The entry's `reqAttune`: `true`, `"optional"`, or who may attune, such as `"by a wizard"`. */
  reqAttune: unknown;
  onChange: (next: true | string | undefined) => void;
  error?: ReactNode;
}

/**
 * Whether the item needs attunement, and by whom. "Required by…" holds `true` until its
 * condition is typed, so the item still needs attunement while the text is empty.
 */
export function ItemAttunementField({ reqAttune, onChange, error }: ItemAttunementFieldProps) {
  const [choice, setChoice] = useState(() => choiceOf(reqAttune));
  const condition = choice === "by" && typeof reqAttune === "string" ? reqAttune : "";
  return (
    <>
      <FormField label="Attunement" error={error}>
        {(control) => (
          <Select
            {...control}
            options={OPTIONS}
            value={choice}
            onChange={(next) => {
              setChoice(next as Choice);
              onChange(next === "" ? undefined : next === "optional" ? "optional" : true);
            }}
          />
        )}
      </FormField>
      {choice === "by" && (
        <InputField
          label="Attuned by"
          placeholder="by a wizard"
          value={condition}
          onChange={(event) =>
            onChange(event.target.value.trim() === "" ? true : event.target.value)
          }
        />
      )}
    </>
  );
}

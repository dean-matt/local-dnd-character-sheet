import { modifierKey, type TemporaryModifier, temporaryModifierSchema } from "@dnd/character";
import { useState } from "react";
import { modifierTargets, targetLabel, targetValue } from "../../../../../lib/modifierTarget.ts";
import { FormField } from "../../../../FormField.tsx";
import { InputField } from "../../../../InputField.tsx";
import { Select } from "../../../../Select.tsx";

const BUTTON =
  "h-8 rounded-control border border-border bg-surface px-3 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const WHOLE = /^[+-]?\d+$/;

const ENDS = [
  { value: "", label: "Until removed" },
  { value: "short", label: "Ends on a rest" },
  { value: "long", label: "Ends on a long rest" },
];

type Errors = { name?: string; amount?: string; target?: string };

/** The modifier the fields hold, or why each refused field is. */
function read(
  fields: { name: string; amount: string; endsOn: string },
  target: TemporaryModifier["target"] | undefined,
  held: readonly TemporaryModifier[],
): { modifier: TemporaryModifier } | { errors: Errors } {
  if (target === undefined) return { errors: { target: "Choose what it applies to." } };
  const typed = fields.amount.trim();
  const parsed = temporaryModifierSchema.safeParse({
    name: fields.name,
    target,
    amount: WHOLE.test(typed) ? Number(typed) : Number.NaN,
    endsOn: fields.endsOn === "" ? null : fields.endsOn,
  });
  if (!parsed.success) {
    return {
      errors: {
        ...(fields.name.trim() === "" && { name: "Enter a name." }),
        ...(fields.name.trim() !== "" &&
          parsed.error.issues.some(({ path }) => path[0] === "name") && {
            name: `${fields.name.trim()} is reserved. Choose another name.`,
          }),
        ...(!WHOLE.test(typed) || Number(typed) === 0
          ? { amount: "The amount is a whole number other than 0." }
          : {}),
      },
    };
  }
  const { data } = parsed;
  if (held.some((other) => modifierKey(other) === modifierKey(data))) {
    return { errors: { name: `${data.name} already modifies ${targetLabel(data.target)}.` } };
  }
  return { modifier: data };
}

/**
 * The fields that name a temporary modifier, the sheet value it moves, its signed amount and
 * when it ends. Fields the schema refuses, or a modifier already held, show their reason and
 * keep what was typed.
 */
export function AddTemporaryModifier({
  skills,
  held,
  busy,
  onAdd,
}: {
  skills: readonly { name: string; source: string }[];
  held: readonly TemporaryModifier[];
  busy: boolean;
  onAdd: (modifier: TemporaryModifier) => void;
}) {
  const targets = modifierTargets(skills);
  const [fields, setFields] = useState({
    name: "",
    target: targetValue({ kind: "armorClass" }),
    amount: "",
    endsOn: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const set = (change: Partial<typeof fields>) => setFields({ ...fields, ...change });

  function add() {
    if (busy) return;
    const target = targets.find((option) => targetValue(option) === fields.target);
    const result = read(fields, target, held);
    if ("errors" in result) return setErrors(result.errors);
    setErrors({});
    setFields({ ...fields, name: "", amount: "" });
    onAdd(result.modifier);
  }

  return (
    <form
      noValidate
      className="mt-2 flex flex-wrap items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        add();
      }}
    >
      <InputField
        label="Modifier name"
        placeholder="Name, such as Bless"
        value={fields.name}
        error={errors.name}
        onChange={(event) => set({ name: event.target.value })}
        className="w-40"
      />
      <InputField
        label="Modifier amount"
        placeholder="+2 or -1"
        inputMode="numeric"
        value={fields.amount}
        error={errors.amount}
        onChange={(event) => set({ amount: event.target.value })}
        className="w-24"
      />
      <FormField label="Applies to" error={errors.target}>
        {(control) => (
          <Select
            {...control}
            options={targets.map((option) => ({
              value: targetValue(option),
              label: targetLabel(option),
            }))}
            value={fields.target}
            onChange={(target) => set({ target })}
          />
        )}
      </FormField>
      <FormField label="Lasts">
        {(control) => (
          <Select
            {...control}
            options={ENDS}
            value={fields.endsOn}
            onChange={(endsOn) => set({ endsOn })}
          />
        )}
      </FormField>
      <button type="submit" aria-disabled={busy} className={`${BUTTON} mt-5`}>
        Add modifier
      </button>
    </form>
  );
}

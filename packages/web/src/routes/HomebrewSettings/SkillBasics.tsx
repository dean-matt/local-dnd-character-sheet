import { ABILITIES, ABILITY_LABEL } from "@dnd/character";
import { useId } from "react";
import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { Select } from "../../components/Select.tsx";
import { useSkillHolders } from "../../hooks/useSkillHolders.ts";
import { type HomebrewFormProps, textAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, SHORT } from "./homebrewGrid.ts";

const ABILITY_OPTIONS = [
  ...ABILITIES.map((ability) => ({ value: ability, label: ABILITY_LABEL[ability] })),
  { value: "flat", label: "Flat bonus" },
];

/** "A", "A and B", "A, B and C". */
function listed(names: readonly string[]) {
  return names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * A homebrew skill's first step: its name and the ability it uses, or a flat bonus whose number
 * each character holding the skill keeps. The ability stays fixed while any character holds the
 * skill, since switching it would change what their sheets show.
 */
export function SkillBasics({ entry, recordId, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const holders = useSkillHolders(recordId);
  const reasonId = useId();
  const held = (holders.data?.length ?? 0) > 0;
  const loading = recordId !== undefined && holders.isPending;
  const reason = holders.isError
    ? "Couldn't check which characters hold this skill."
    : loading
      ? "Checking which characters hold this skill."
      : held
        ? `Held by ${listed((holders.data ?? []).map(({ name }) => name))}; remove it from them first`
        : undefined;

  return (
    <div className={FORM_GRID}>
      <div className={PAIRED}>
        <InputField
          label="Name"
          value={textAt(entry, "name")}
          onChange={(event) => set("name", event.target.value)}
          error={errorFor("name")}
        />
      </div>
      <div className={SHORT}>
        <FormField label="Ability" error={errorFor("ability")}>
          {(control) => (
            <Select
              {...control}
              aria-describedby={reason ? reasonId : control["aria-describedby"]}
              aria-disabled={reason !== undefined}
              options={ABILITY_OPTIONS}
              value={textAt(entry, "ability")}
              onChange={(next) => set("ability", next)}
            />
          )}
        </FormField>
        {reason && (
          <p id={reasonId} className="mt-1 text-muted text-row">
            {reason}
          </p>
        )}
      </div>
    </div>
  );
}

import { ABILITIES, ABILITY_LABEL } from "@dnd/character";
import { useSkillHolders } from "../../hooks/useSkillHolders.ts";
import { FormField } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";
import { Select } from "../Select.tsx";
import { HeldByNote } from "./HeldByNote.tsx";
import { type HomebrewFormProps, textAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, SHORT } from "./homebrewGrid.ts";

const ABILITY_OPTIONS = [
  ...ABILITIES.map((ability) => ({ value: ability, label: ABILITY_LABEL[ability] })),
  { value: "flat", label: "Flat bonus" },
];

/**
 * A homebrew skill's first step: its name and the ability it uses, or a flat bonus whose number
 * each character holding the skill keeps. Switching between an ability and a flat bonus resets
 * each holder's flat number and override of the skill, so while any character holds it an info
 * icon beside the label lists them, linked, and says so.
 */
export function SkillBasics({ entry, recordId, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const holders = useSkillHolders(recordId);
  const held = holders.data ?? [];
  const note =
    holders.isError || held.length > 0 ? (
      <HeldByNote
        label="Who holds this skill"
        holders={holders.isError ? undefined : held}
        message="Held by the following characters, changing will reset custom values"
        failure="Couldn't check which characters hold this skill. Changing it may reset their custom values."
      />
    ) : undefined;

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
        <FormField
          label="Ability"
          error={errorFor("ability")}
          labelAddon={
            // No font size, so the popover's inline box adds no line-height strut around the icon.
            note && <span className="flex text-[0px]">{note}</span>
          }
        >
          {(control) => (
            <Select
              {...control}
              options={ABILITY_OPTIONS}
              value={textAt(entry, "ability")}
              onChange={(next) => set("ability", next)}
            />
          )}
        </FormField>
      </div>
    </div>
  );
}

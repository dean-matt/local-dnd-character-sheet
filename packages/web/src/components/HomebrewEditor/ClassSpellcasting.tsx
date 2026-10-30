import { casterProgressionSchema } from "@dnd/catalog";
import { FormField } from "../FormField.tsx";
import { Select } from "../Select.tsx";
import { type HomebrewFormProps, textAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED } from "./homebrewGrid.ts";
import { ABILITY_OPTIONS, withCurrent } from "./homebrewOptions.ts";

const NONE = { value: "", label: "Does not cast" };

const CASTER_PROGRESSIONS = casterProgressionSchema.in.shape.casterProgression.unwrap().options;

const PROGRESSION_LABEL: Record<(typeof CASTER_PROGRESSIONS)[number], string> = {
  full: "Full caster",
  "1/2": "Half caster",
  "1/3": "Third caster",
  artificer: "Half caster, rounded up",
  pact: "Pact magic",
};

const PROGRESSIONS = [
  NONE,
  ...CASTER_PROGRESSIONS.map((value) => ({ value, label: PROGRESSION_LABEL[value] })),
];

/** The ability a homebrew class casts with, and the slot table it follows. */
export function ClassSpellcasting({ entry, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value || undefined));
  const ability = textAt(entry, "spellcastingAbility");
  const progression = textAt(entry, "casterProgression");
  return (
    <div className={FORM_GRID}>
      <div className={PAIRED}>
        <FormField label="Spellcasting ability" error={errorFor("spellcastingAbility")}>
          {(control) => (
            <Select
              {...control}
              options={withCurrent([NONE, ...ABILITY_OPTIONS], ability)}
              value={ability}
              onChange={(next) => set("spellcastingAbility", next)}
            />
          )}
        </FormField>
      </div>
      <div className={PAIRED}>
        <FormField label="Spell slot progression" error={errorFor("casterProgression")}>
          {(control) => (
            <Select
              {...control}
              options={withCurrent(PROGRESSIONS, progression)}
              value={progression}
              onChange={(next) => set("casterProgression", next)}
            />
          )}
        </FormField>
      </div>
    </div>
  );
}

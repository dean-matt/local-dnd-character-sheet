import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { Select } from "../../components/Select.tsx";
import { RARITIES } from "../../lib/rarities.ts";
import { HomebrewCheckbox } from "./HomebrewCheckbox.tsx";
import {
  type HomebrewFormProps,
  numberAt,
  signed,
  textAt,
  typedInteger,
  unsigned,
  withField,
} from "./homebrewEntry.ts";
import { FORM_GRID, SHORT, WHOLE } from "./homebrewGrid.ts";
import { NOT_STATED, withCurrent } from "./homebrewOptions.ts";
import { itemGroup } from "./homebrewVocabulary.ts";
import { ItemAbilityFields } from "./ItemAbilityFields.tsx";
import { ItemSpeedFields } from "./ItemSpeedFields.tsx";

const BONUSES = [
  ["bonusAc", "Bonus to AC"],
  ["bonusSavingThrow", "Bonus to saving throws"],
  ["bonusSavingThrowConcentration", "Bonus to concentration saves"],
  ["bonusAbilityCheck", "Bonus to ability checks"],
  ["bonusProficiencyBonus", "Bonus to proficiency bonus"],
  ["bonusSpellAttack", "Bonus to spell attacks"],
  ["bonusSpellSaveDc", "Bonus to spell save DC"],
  ["bonusSpellDamage", "Bonus to spell damage"],
] as const;

/**
 * What makes a homebrew item magic: its rarity and attunement, its bonuses, the critical
 * range it grants, and what it does to ability scores and speeds. A weapon adds its bonus to
 * attack and damage rolls.
 */
export function ItemMagic({ entry, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const rarity = textAt(entry, "rarity");
  const bonus = (key: string, label: string) => (
    <div key={key} className={SHORT}>
      <InputField
        label={label}
        type="number"
        step={1}
        value={unsigned(entry[key]) ?? ""}
        onChange={(event) => set(key, signed(typedInteger(event.target.value)))}
        error={errorFor(key)}
      />
    </div>
  );

  return (
    <div className={FORM_GRID}>
      <div className={SHORT}>
        <FormField label="Rarity" error={errorFor("rarity")}>
          {(control) => (
            <Select
              {...control}
              options={withCurrent([NOT_STATED, ...RARITIES], rarity)}
              value={rarity}
              onChange={(next) => set("rarity", next || undefined)}
            />
          )}
        </FormField>
      </div>
      <div className="col-span-1 flex items-end pb-2 @2xl:col-span-3">
        <HomebrewCheckbox
          label="Requires attunement"
          checked={Boolean(entry.reqAttune)}
          onChange={(checked) => set("reqAttune", checked || undefined)}
          error={errorFor("reqAttune")}
        />
      </div>
      {itemGroup(entry.type) === "weapon" && bonus("bonusWeapon", "Bonus to attack and damage")}
      {BONUSES.map(([key, label]) => bonus(key, label))}
      <div className={SHORT}>
        <InputField
          label="Critical hit on"
          type="number"
          min={2}
          max={19}
          step={1}
          placeholder="20"
          value={numberAt(entry.critThreshold) ?? ""}
          onChange={(event) => set("critThreshold", typedInteger(event.target.value))}
          error={errorFor("critThreshold")}
        />
      </div>
      <div className={WHOLE}>
        <ItemAbilityFields
          ability={entry.ability}
          onChange={(next) => set("ability", next)}
          error={errorFor("ability")}
        />
      </div>
      <div className={WHOLE}>
        <ItemSpeedFields
          speed={entry.modifySpeed}
          onChange={(next) => set("modifySpeed", next)}
          error={errorFor("modifySpeed")}
        />
      </div>
    </div>
  );
}

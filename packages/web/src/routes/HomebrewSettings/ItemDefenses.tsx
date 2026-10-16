import { MultiSelect } from "../../components/MultiSelect.tsx";
import { CONDITIONS, DAMAGE_TYPE_NAMES } from "../../lib/defenseVocabulary.ts";
import {
  chosenIn,
  type HomebrewFormProps,
  listAt,
  withChosen,
  withField,
} from "./homebrewEntry.ts";
import { FORM_GRID, TEXT } from "./homebrewGrid.ts";
import { useCatalogBlurbs } from "./useCatalogBlurbs.ts";

/** What a homebrew item grants against damage and conditions, and the damage it leaves the wearer vulnerable to. */
const CONDITION_NAMES = CONDITIONS.map(({ label }) => label);

export function ItemDefenses({ entry, edition, onChange }: HomebrewFormProps) {
  const blurbs = useCatalogBlurbs("condition", CONDITION_NAMES, edition);
  const conditions = CONDITIONS.map((option) => ({ ...option, description: blurbs[option.label] }));
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const defenses = (key: string, legend: string, noun: string, options: typeof CONDITIONS) => (
    <MultiSelect
      inForm
      label={legend}
      noun={noun}
      options={options}
      selected={chosenIn(listAt(entry, key))}
      onChange={(chosen) => set(key, withChosen(listAt(entry, key), chosen))}
    />
  );

  return (
    <div className={FORM_GRID}>
      <div className={TEXT}>
        {defenses("resist", "Resistances", "damage types", DAMAGE_TYPE_NAMES)}
      </div>
      <div className={TEXT}>
        {defenses("immune", "Damage immunities", "damage types", DAMAGE_TYPE_NAMES)}
      </div>
      <div className={TEXT}>
        {defenses("vulnerable", "Damage vulnerabilities", "damage types", DAMAGE_TYPE_NAMES)}
      </div>
      <div className={TEXT}>
        {defenses("conditionImmune", "Condition immunities", "conditions", conditions)}
      </div>
    </div>
  );
}

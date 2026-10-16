import { CONDITIONS, DAMAGE_TYPE_NAMES } from "../../lib/defenseVocabulary.ts";
import { AdvantageFields } from "./AdvantageFields.tsx";
import { HomebrewCheckboxGroup } from "./HomebrewCheckboxGroup.tsx";
import {
  chosenIn,
  type HomebrewFormProps,
  listAt,
  withChosen,
  withField,
} from "./homebrewEntry.ts";
import { FORM_GRID, WHOLE } from "./homebrewGrid.ts";

/** What a homebrew item grants against damage, conditions and rolls, and the damage it leaves the wearer vulnerable to. */
export function ItemDefenses({ entry, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const defenses = (key: string, legend: string, options: typeof CONDITIONS) => (
    <HomebrewCheckboxGroup
      legend={legend}
      options={options}
      chosen={chosenIn(listAt(entry, key))}
      onChange={(chosen) => set(key, withChosen(listAt(entry, key), chosen))}
    />
  );

  return (
    <div className={FORM_GRID}>
      <div className={WHOLE}>{defenses("resist", "Resistances", DAMAGE_TYPE_NAMES)}</div>
      <div className={WHOLE}>{defenses("immune", "Damage immunities", DAMAGE_TYPE_NAMES)}</div>
      <div className={WHOLE}>
        {defenses("vulnerable", "Damage vulnerabilities", DAMAGE_TYPE_NAMES)}
      </div>
      <div className={WHOLE}>{defenses("conditionImmune", "Condition immunities", CONDITIONS)}</div>
      <div className={WHOLE}>
        <AdvantageFields
          effects={listAt(entry, "advantage")}
          onChange={(next) => set("advantage", next.length > 0 ? next : undefined)}
          error={errorFor("advantage")}
        />
      </div>
    </div>
  );
}

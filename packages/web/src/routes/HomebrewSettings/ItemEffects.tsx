import { AdvantageFields } from "./AdvantageFields.tsx";
import { type HomebrewFormProps, listAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, WHOLE } from "./homebrewGrid.ts";
import { ItemAbilityFields } from "./ItemAbilityFields.tsx";
import { ItemSpeedFields } from "./ItemSpeedFields.tsx";

/** What a homebrew item does to the wearer's ability scores, speeds and rolls. */
export function ItemEffects({ entry, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  return (
    <div className={FORM_GRID}>
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

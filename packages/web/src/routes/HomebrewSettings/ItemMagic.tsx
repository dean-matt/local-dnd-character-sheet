import { FormField } from "../../components/FormField.tsx";
import { Select } from "../../components/Select.tsx";
import { RARITIES } from "../../lib/rarities.ts";
import { type HomebrewFormProps, textAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, SHORT, TEXT, WHOLE } from "./homebrewGrid.ts";
import { NOT_STATED, withCurrent } from "./homebrewOptions.ts";
import { itemGroup } from "./homebrewVocabulary.ts";
import { ItemAttunementField } from "./ItemAttunementField.tsx";
import { ItemBonusFields } from "./ItemBonusFields.tsx";

/** What makes a homebrew item magic: its rarity, its attunement, and the bonuses it grants. */
export function ItemMagic({ entry, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const rarity = textAt(entry, "rarity");

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
      <div className={`${TEXT} grid grid-cols-2 items-end gap-3`}>
        <ItemAttunementField
          reqAttune={entry.reqAttune}
          onChange={(next) => set("reqAttune", next)}
          error={errorFor("reqAttune")}
        />
      </div>
      <div className={WHOLE}>
        <ItemBonusFields
          entry={entry}
          onChange={onChange}
          weapon={itemGroup(entry.type) === "weapon"}
        />
      </div>
    </div>
  );
}

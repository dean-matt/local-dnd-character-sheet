import { HOMEBREW_SOURCE } from "@dnd/catalog";
import { titleCase } from "../../lib/proficiencyGrants.ts";
import { CatalogPicker } from "../CatalogPicker/CatalogPicker.tsx";
import { InputField } from "../InputField.tsx";
import { RemovableChipList } from "../RemovableChipList.tsx";
import { type EquipmentState, readEquipment, writeEquipment } from "./backgroundEquipmentShapes.ts";
import { type HomebrewFormProps, typedNumber, withField } from "./homebrewEntry.ts";
import { FORM_GRID, TEXT, WHOLE } from "./homebrewGrid.ts";

/**
 * A homebrew background's starting equipment: the items, picked from the edition's catalog,
 * the gold listed with them, and the gold taken instead. A quantity or a name an item
 * carries, and an entry such as a pouch of coins, stays as written.
 */
export function BackgroundEquipment({ entry, edition, onChange, errorFor }: HomebrewFormProps) {
  const state = readEquipment(entry.startingEquipment);
  if (!state) {
    return (
      <div className="flex flex-col">
        <span className="mb-1 text-muted text-row">Starting equipment</span>
        <p className="text-muted text-row">
          This background states its equipment in a shape the form cannot show. Edit it in JSON.
        </p>
      </div>
    );
  }
  const write = (next: EquipmentState) =>
    onChange(withField(entry, "startingEquipment", writeEquipment(entry.startingEquipment, next)));
  const error = errorFor("startingEquipment");
  const gold = (label: string, key: "coins" | "instead") => (
    <div className={TEXT}>
      <InputField
        label={label}
        type="number"
        min={0}
        value={state[key] ?? ""}
        onChange={(event) => write({ ...state, [key]: typedNumber(event.target.value) ?? null })}
      />
    </div>
  );
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 font-semibold text-row">Starting equipment</legend>
      <div className={FORM_GRID}>
        <div className={WHOLE}>
          <RemovableChipList
            items={state.items.map((item) => ({
              key: item,
              label: titleCase(item.split("|")[0] ?? item),
            }))}
            onRemove={(key) =>
              write({ ...state, items: state.items.filter((item) => item !== key) })
            }
            empty="No items."
          />
        </div>
        <div className={WHOLE}>
          <CatalogPicker
            label="Add an item"
            edition={edition}
            type="item"
            onPick={(_ref, hit) => {
              const item =
                `${hit.name}|${"source" in hit ? hit.source : HOMEBREW_SOURCE}`.toLowerCase();
              if (!state.items.includes(item)) write({ ...state, items: [...state.items, item] });
            }}
          />
        </div>
        {gold("Gold with the items (GP)", "coins")}
        {gold("Gold instead of the items (GP)", "instead")}
      </div>
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
    </fieldset>
  );
}

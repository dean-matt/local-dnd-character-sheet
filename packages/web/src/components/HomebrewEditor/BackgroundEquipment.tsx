import { HOMEBREW_SOURCE } from "@dnd/catalog";
import { titleCase } from "../../lib/proficiencyGrants.ts";
import { CatalogPicker } from "../CatalogPicker/CatalogPicker.tsx";
import { EmptyNote } from "../EmptyNote.tsx";
import { InputField } from "../InputField.tsx";
import { RemoveButton } from "../RemoveButton.tsx";
import { type EquipmentState, readEquipment, writeEquipment } from "./backgroundEquipmentShapes.ts";
import { type HomebrewFormProps, typedInteger, typedNumber, withField } from "./homebrewEntry.ts";
import { FORM_GRID, TEXT, WHOLE } from "./homebrewGrid.ts";

/**
 * A homebrew background's starting equipment: the items, picked from the edition's catalog,
 * the gold listed with them, and the gold taken instead, and the quantity of each item. A name an item carries, and an
 * entry such as a pouch of coins, stays as written.
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
        <ul className={`${WHOLE} flex flex-col gap-2`}>
          {state.items.length === 0 && <EmptyNote>No items.</EmptyNote>}
          {state.items.map(({ item, quantity }) => {
            const name = titleCase(item.split("|")[0] ?? item);
            return (
              <li key={item} className="flex items-end gap-2">
                <span className="flex-1 text-row">{name}</span>
                <div className="w-24">
                  <InputField
                    label={`${name} quantity`}
                    type="number"
                    min={1}
                    step={1}
                    value={quantity}
                    onChange={(event) =>
                      write({
                        ...state,
                        items: state.items.map((entry) =>
                          entry.item === item
                            ? { item, quantity: Math.max(1, typedInteger(event.target.value) ?? 1) }
                            : entry,
                        ),
                      })
                    }
                  />
                </div>
                <RemoveButton
                  name={name}
                  busy={false}
                  onRemove={() =>
                    write({ ...state, items: state.items.filter((entry) => entry.item !== item) })
                  }
                />
              </li>
            );
          })}
        </ul>
        <div className={WHOLE}>
          <CatalogPicker
            label="Add an item"
            edition={edition}
            type="item"
            onPick={(_ref, hit) => {
              const item =
                `${hit.name}|${"source" in hit ? hit.source : HOMEBREW_SOURCE}`.toLowerCase();
              if (!state.items.some((entry) => entry.item === item))
                write({ ...state, items: [...state.items, { item, quantity: 1 }] });
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

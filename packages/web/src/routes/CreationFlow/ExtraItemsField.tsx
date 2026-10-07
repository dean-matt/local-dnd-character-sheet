import type { CharacterDefinition, EntryRef } from "@dnd/character";
import { X } from "lucide-react";
import { CatalogPicker } from "../../components/CatalogPicker/CatalogPicker.tsx";
import { pickedName } from "./equipmentLabels.ts";

type InventoryEntry = CharacterDefinition["inventory"][number];

export interface ExtraItemsFieldProps {
  edition: CharacterDefinition["edition"];
  /** The inventory entries no starting-equipment pick landed. */
  extras: InventoryEntry[];
  names: Record<string, string>;
  onAdd: (ref: EntryRef, name: string) => void;
  /** Takes out the entry at `index` in `extras`. */
  onRemove: (index: number) => void;
}

/** The way past the lists: any catalog or homebrew item, added one at a time, each removable. */
export function ExtraItemsField({ edition, extras, names, onAdd, onRemove }: ExtraItemsFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <CatalogPicker
        label="Add an item not on the lists"
        edition={edition}
        type="item"
        onPick={(ref, hit) => onAdd(ref, hit.name)}
      />
      {extras.length > 0 && (
        <ul className="flex flex-col gap-1">
          {extras.map((extra, index) => {
            const name = pickedName(extra.ref, names);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: two entries can hold the same item, and the list is redrawn whole.
              <li key={index} className="flex items-center gap-2 text-body">
                {extra.quantity > 1 ? `${extra.quantity} × ${name}` : name}
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove ${name}`}
                  className="flex size-5 items-center justify-center rounded-pill text-muted hover:bg-border"
                >
                  <X aria-hidden="true" size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

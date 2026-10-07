import type { SearchHit } from "@dnd/catalog";
import type { CharacterDefinition, EntryRef } from "@dnd/character";
import { CatalogPicker } from "../../components/CatalogPicker/CatalogPicker.tsx";
import { ChosenChip } from "./ChosenChip.tsx";
import { typeFilters, typeLabel, typeMismatch } from "./equipmentTypes.ts";

export interface EquipmentSlotFieldProps {
  edition: CharacterDefinition["edition"];
  types: string[];
  /** Which copy this slot fills where the option asks for more than one, such as two martial weapons. */
  copy?: { at: number; of: number };
  /** The picked item's name, or `undefined` while the slot is empty. */
  picked: string | undefined;
  onPick: (ref: EntryRef, hit: SearchHit) => void;
  onClear: () => void;
}

/** A slot an option leaves open, such as any martial weapon: a picker narrowed to the kind, or the item picked. */
export function EquipmentSlotField({
  edition,
  types,
  copy,
  picked,
  onPick,
  onClear,
}: EquipmentSlotFieldProps) {
  const label = `Choose ${typeLabel(types)}${copy ? ` (${copy.at} of ${copy.of})` : ""}`;
  return picked === undefined ? (
    <CatalogPicker
      label={label}
      edition={edition}
      type="item"
      filters={typeFilters(types)}
      unavailableReason={(hit) => typeMismatch(types, hit)}
      onPick={onPick}
    />
  ) : (
    <ChosenChip label={label} value={picked} onClear={onClear} />
  );
}

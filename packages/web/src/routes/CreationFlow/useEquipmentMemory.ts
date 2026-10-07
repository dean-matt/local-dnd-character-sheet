import { useState } from "react";
import { type EquipmentMemory, NO_EQUIPMENT } from "./equipmentPicks.ts";

const KEY = "draft:creation:equipment";

function stored(): EquipmentMemory | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? undefined : (JSON.parse(raw) as EquipmentMemory);
  } catch {
    return undefined;
  }
}

/**
 * The flow's starting-equipment picks, kept in `localStorage` beside the draft so a
 * reload keeps them with the inventory they landed: read back off the inventory, a gold
 * roll or a slot's pick could not be told from an item added by hand. A fresh flow starts
 * from none, discarding what an earlier flow left. Storage that throws keeps the picks
 * for the visit alone, and the draft that holds the inventory is lost with them.
 */
export function useEquipmentMemory(fresh: boolean) {
  const [memory, setMemory] = useState<EquipmentMemory>(() => {
    if (!fresh) return stored() ?? NO_EQUIPMENT;
    try {
      localStorage.removeItem(KEY);
    } catch {}
    return NO_EQUIPMENT;
  });
  const hold = (next: EquipmentMemory) => {
    setMemory(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  };
  return [memory, hold] as const;
}

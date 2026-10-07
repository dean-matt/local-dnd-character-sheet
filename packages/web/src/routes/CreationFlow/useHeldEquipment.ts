import type { CharacterDefinition } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { type EquipmentMemory, withoutLanded } from "./equipmentPicks.ts";
import { useEquipmentSources } from "./useEquipmentSources.ts";

/**
 * The starting equipment on offer, `undefined` while a row it reads has not loaded, and
 * the inventory entries no pick in `memory` landed.
 */
export function useHeldEquipment(memory: EquipmentMemory) {
  const inventory = useWatch<CharacterDefinition, "inventory">({ name: "inventory" }) ?? [];
  return { sources: useEquipmentSources(), extras: withoutLanded(inventory, memory.landed) };
}

import type { CharacterDefinition } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { type EquipmentMemory, inferMemory, withoutLanded } from "./equipmentPicks.ts";
import { useEquipmentSources } from "./useEquipmentSources.ts";

/**
 * The starting equipment on offer, the picks the flow holds — read off the inventory
 * where it holds none, as after a reload — and the inventory entries no pick landed.
 * `sources` and `held` are `undefined` while a row they read has not loaded.
 */
export function useHeldEquipment(memory: EquipmentMemory | undefined) {
  const inventory = useWatch<CharacterDefinition, "inventory">({ name: "inventory" }) ?? [];
  const sources = useEquipmentSources();
  const held = memory ?? (sources && inferMemory(sources, inventory));
  return { sources, held, extras: held ? withoutLanded(inventory, held.landed) : [] };
}

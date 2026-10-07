import type { CharacterDefinition } from "@dnd/character";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { setRefValue } from "../../lib/setRefValue.ts";
import { withDeparture } from "./departures.ts";
import { pickedName } from "./equipmentLabels.ts";
import {
  coins,
  type EquipmentMemory,
  INVENTORY_FIELD,
  landing,
  withoutLanded,
} from "./equipmentPicks.ts";
import { useHeldEquipment } from "./useHeldEquipment.ts";

export interface CreationEquipmentProps {
  memory: EquipmentMemory;
  onMemory: (memory: EquipmentMemory) => void;
}

/**
 * Keeps the inventory and the purse in step with the starting-equipment picks, on every
 * step, so a class changed on Class never carries the old class's equipment to Finish.
 * A pick lands its items as references with their quantities and takes back what the
 * pick it replaced landed, leaving what the player added by hand; the coins the picks
 * hand over are the purse, which nothing else in the flow sets. An item past the lists is
 * kept and noted as a departure.
 */
export function CreationEquipment({ memory, onMemory }: CreationEquipmentProps) {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const { sources, extras } = useHeldEquipment(memory);
  const key = JSON.stringify([sources, memory]);
  const ready = sources !== undefined;
  const note =
    extras.length > 0
      ? `Added beyond the starting equipment: ${extras.map((extra) => pickedName(extra.ref, memory.names)).join(", ")}.`
      : undefined;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `sources` and `memory`, rebuilt each render.
  useEffect(() => {
    if (sources === undefined) return;
    const target = landing(sources, memory);
    if (JSON.stringify(target.inventory) !== JSON.stringify(memory.landed)) {
      const current = getValues("inventory") ?? [];
      setRefValue(
        setValue,
        "inventory",
        [...target.inventory, ...withoutLanded(current, memory.landed)],
        { shouldDirty: true },
      );
      onMemory({ ...memory, landed: target.inventory });
    }
    const purse = coins(target.copper);
    if (JSON.stringify(purse) !== JSON.stringify(getValues("money")))
      setValue("money", purse, { shouldDirty: true });
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    const departures = getValues("departures");
    const next = withDeparture(departures, INVENTORY_FIELD, note);
    if (JSON.stringify(next) !== JSON.stringify(departures ?? []))
      setValue("departures", next, { shouldDirty: true });
  }, [ready, note, getValues, setValue]);

  return null;
}

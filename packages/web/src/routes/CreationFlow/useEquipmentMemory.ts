import { characterDefinitionSchema } from "@dnd/character";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { type EquipmentMemory, NO_EQUIPMENT } from "./equipmentPicks.ts";

const KEY = "draft:creation:equipment";

/**
 * The stored picks' outline, so a key an older build wrote in another shape reads as no
 * picks rather than throwing on the reload it exists for.
 */
const sourcePicksSchema = z.object({
  row: z.string(),
  options: z.record(z.string(), z.string()),
  slots: z.record(z.string(), z.unknown()),
});

const storedSchema = z.object({
  picks: z.object({
    Class: sourcePicksSchema.optional(),
    Background: sourcePicksSchema.optional(),
  }),
  gold: z.object({ row: z.string(), gp: z.number() }).optional(),
  landed: characterDefinitionSchema.shape.inventory,
  names: z.record(z.string(), z.string()),
});

function stored(): EquipmentMemory | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return storedSchema.safeParse(parsed).success ? (parsed as EquipmentMemory) : undefined;
  } catch {
    return undefined;
  }
}

function store(memory: EquipmentMemory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {}
}

/**
 * The flow's starting-equipment picks, kept in `localStorage` with the draft's lifecycle,
 * so a reload keeps them with the inventory they landed: read back off the inventory, a
 * gold roll or a slot's pick could not be told from an item added by hand. A fresh flow
 * starts from none, and leaving the flow discards them, as it does the draft; the mount
 * write restores what StrictMode's rehearsal unmount discarded. Storage that throws keeps
 * the picks for the visit alone, and the draft holding the inventory is lost with them.
 */
export function useEquipmentMemory(fresh: boolean) {
  const [memory, setMemory] = useState<EquipmentMemory>(() =>
    fresh ? NO_EQUIPMENT : (stored() ?? NO_EQUIPMENT),
  );
  const latest = useRef(memory);
  useEffect(() => {
    store(latest.current);
    return () => {
      try {
        localStorage.removeItem(KEY);
      } catch {}
    };
  }, []);
  const hold = (next: EquipmentMemory) => {
    latest.current = next;
    setMemory(next);
    store(next);
  };
  return [memory, hold] as const;
}

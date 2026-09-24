import type { SheetSection } from "@dnd/character";
import { EmptyState } from "../../states.tsx";
import type { BlockViewProps } from "./types.ts";

const SECTION_LABELS: Record<SheetSection, string> = {
  abilities: "Abilities",
  spells: "Spells",
  inventory: "Inventory",
  features: "Features",
};

/** A whole sheet section. Each one renders for real once its own issue ships it. */
export function SectionBlockView({ block }: BlockViewProps) {
  if (block.kind !== "section") return null;
  return <EmptyState>{SECTION_LABELS[block.section]} isn't built yet.</EmptyState>;
}

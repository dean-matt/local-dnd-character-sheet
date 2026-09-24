import type { ListBlockSource } from "@dnd/character";
import { EmptyState } from "../../states.tsx";
import type { BlockViewProps } from "./types.ts";

const SOURCE_LABELS: Record<ListBlockSource, string> = {
  spells: "Spells",
  inventory: "Inventory",
  features: "Features",
};

/** A saved filter over one of the sheet's own lists. The list itself is a later issue. */
export function ListBlockView({ block }: BlockViewProps) {
  if (block.kind !== "list") return null;
  return <EmptyState>{SOURCE_LABELS[block.source]} isn't available yet.</EmptyState>;
}

import { EmptyState } from "../../EmptyState.tsx";
import { describeFilter, SOURCE_LABELS } from "../../lib/blockLabels.ts";
import type { BlockViewProps } from "./types.ts";

/**
 * A saved filter over one of the sheet's own lists, named in words and not the rows it matches.
 */
export function ListBlockView({ block }: BlockViewProps) {
  if (block.kind !== "list") return null;
  const filter = describeFilter(block.filter);
  return (
    <EmptyState>
      {SOURCE_LABELS[block.source]}
      {filter && ` (${filter})`} isn't available yet.
    </EmptyState>
  );
}

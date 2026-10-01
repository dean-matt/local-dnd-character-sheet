import { RulesText } from "../RulesText.tsx";
import type { BlockViewProps } from "./types.ts";

/** A note in the same `{@tag}` markup a catalog row's prose carries. */
export function TextBlockView({ block }: BlockViewProps) {
  if (block.kind !== "text") return null;
  return (
    <p>
      <RulesText text={block.text} />
    </p>
  );
}

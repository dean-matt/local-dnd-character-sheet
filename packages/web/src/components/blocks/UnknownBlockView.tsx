import type { BlockViewProps } from "./types.ts";

/** A block this build does not recognize, rendered inert so it cannot break the page around it. */
export function UnknownBlockView({ block }: BlockViewProps) {
  if (block.kind !== "unknown") return null;
  return <p className="text-muted text-row italic">This block isn't recognized by this build.</p>;
}

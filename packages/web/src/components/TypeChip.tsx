import type { ReactNode } from "react";
import { CHIP } from "../lib/chipStyles.ts";
import { Tag } from "./Tag.tsx";

/**
 * Each fill keyed by a search hit's `type` or a detail's label. A row that belongs to
 * another, such as a subrace or a magic variant, takes its parent's fill.
 */
const FILLS: Record<string, string> = {
  spell: "bg-type-spell",
  item: "bg-type-item",
  "magic variant": "bg-type-item",
  feat: "bg-type-feat",
  race: "bg-type-race",
  subrace: "bg-type-race",
  "class feature": "bg-type-feature",
  "subclass feature": "bg-type-feature",
  monster: "bg-type-monster",
};

/** A catalog row's type, filled in its type's color, or the neutral `Tag` for a type with none. */
export function TypeChip({ type, children }: { type: string; children: ReactNode }) {
  const fill = FILLS[type];
  if (!fill) return <Tag>{children}</Tag>;
  return (
    <span className={`${CHIP} border-transparent ${fill} text-white uppercase`}>{children}</span>
  );
}

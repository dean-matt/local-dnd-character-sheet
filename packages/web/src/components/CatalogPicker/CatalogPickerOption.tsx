import type { SearchHit } from "@dnd/catalog";
import { useEffect, useRef } from "react";
import { Tag } from "../Tag.tsx";

export interface CatalogPickerOptionProps {
  id: string;
  hit: SearchHit;
  /** Why this row cannot be picked; absent where it can. */
  reason: string | undefined;
  active: boolean;
  onPick: () => void;
  onPoint: () => void;
}

export function CatalogPickerOption({
  id,
  hit,
  reason,
  active,
  onPick,
  onPoint,
}: CatalogPickerOptionProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: focus stays in the combobox input, which handles every key.
    <div
      ref={ref}
      id={id}
      role="option"
      tabIndex={-1}
      aria-selected={active}
      aria-disabled={reason === undefined ? undefined : true}
      onMouseEnter={onPoint}
      onClick={onPick}
      className={`flex flex-wrap items-baseline gap-x-2 rounded-control px-2 py-1.5 text-body ${
        active ? "bg-accent-tint" : ""
      } ${reason === undefined ? "cursor-pointer" : "cursor-not-allowed text-muted"}`}
    >
      <span>{hit.name}</span>
      {"id" in hit ? (
        <Tag>Homebrew</Tag>
      ) : (
        <span className="text-muted text-row">{hit.source}</span>
      )}
      {reason !== undefined && <span className="text-row">{reason}</span>}
    </div>
  );
}

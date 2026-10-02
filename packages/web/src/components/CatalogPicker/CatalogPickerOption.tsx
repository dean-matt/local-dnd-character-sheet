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
    // The input keeps focus throughout, as a combobox's does, so the option takes no
    // key handler of its own and a mousedown is cancelled before it can blur the input.
    // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input handles every key.
    <div
      ref={ref}
      id={id}
      role="option"
      tabIndex={-1}
      aria-selected={active}
      aria-disabled={reason === undefined ? undefined : true}
      onMouseDown={(event) => event.preventDefault()}
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

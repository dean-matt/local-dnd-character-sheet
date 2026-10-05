import { useEffect, useRef } from "react";
import { SourceChip } from "../../../../components/SourceChip.tsx";
import { TypeChip } from "../../../../components/TypeChip.tsx";
import { searchHitTypeLabel } from "../../../../lib/searchHits.ts";
import { CharacterAvatar } from "../CharacterAvatar.tsx";
import type { SearchResult } from "./searchResult.ts";

export interface SearchResultOptionProps {
  id: string;
  result: SearchResult;
  active: boolean;
  onPick: () => void;
  onPoint: () => void;
}

export function SearchResultOption({
  id,
  result,
  active,
  onPick,
  onPoint,
}: SearchResultOptionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const opens = "character" in result || result.address !== undefined;

  useEffect(() => {
    if (active) ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const { type, chip, name, meta } =
    "character" in result
      ? {
          type: "character",
          chip: "Character",
          name: result.character.name,
          meta: (
            <span className="truncate">
              {result.character.raceSummary} {result.character.classSummary} • Lvl{" "}
              {result.character.level}
            </span>
          ),
        }
      : {
          type: result.hit.type,
          chip: searchHitTypeLabel(result.hit.type),
          name: result.hit.name,
          meta: (
            <SourceChip
              source={"source" in result.hit ? result.hit.source : undefined}
              edition={result.hit.edition}
              of={searchHitTypeLabel(result.hit.type).toLowerCase()}
            />
          ),
        };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: focus stays in the combobox input, which handles every key.
    <div
      ref={ref}
      id={id}
      role="option"
      tabIndex={-1}
      aria-selected={active}
      aria-disabled={opens ? undefined : true}
      onMouseEnter={onPoint}
      onClick={onPick}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${active ? "bg-accent-tint" : ""} ${opens ? "cursor-pointer" : "cursor-not-allowed"}`}
    >
      {"character" in result && (
        <CharacterAvatar id={result.character.id} name={result.character.name} />
      )}
      <span className="min-w-0 grow">
        <span className="block truncate text-body font-medium text-ink">{name}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted">
          {meta}
          {!opens && <span className="truncate">No page yet</span>}
        </span>
      </span>
      <TypeChip type={type}>{chip}</TypeChip>
    </div>
  );
}

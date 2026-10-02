import type { SearchHit } from "@dnd/catalog";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { SourceChip } from "../../../../components/SourceChip.tsx";
import { Tag } from "../../../../components/Tag.tsx";
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

function hitMeta(hit: SearchHit): ReactNode {
  return (
    <SourceChip
      source={"source" in hit ? hit.source : undefined}
      edition={hit.edition}
      of={searchHitTypeLabel(hit.type).toLowerCase()}
    />
  );
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

  const { chip, name, meta } =
    "character" in result
      ? {
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
          chip: searchHitTypeLabel(result.hit.type),
          name: result.hit.name,
          meta: hitMeta(result.hit),
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
      <Tag>{chip}</Tag>
    </div>
  );
}

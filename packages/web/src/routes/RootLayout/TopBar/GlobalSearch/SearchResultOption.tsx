import type { SearchHit } from "@dnd/catalog";
import { useEffect, useRef } from "react";
import { Tag } from "../../../../components/Tag.tsx";
import { EDITION_LABELS } from "../../../../lib/editionLabels.ts";
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

function hitMeta(hit: SearchHit): string {
  const source = "id" in hit ? "Homebrew" : hit.source;
  return hit.edition ? `${source} • ${EDITION_LABELS[hit.edition]}` : source;
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

  const [chip, name, meta] =
    "character" in result
      ? [
          "Character",
          result.character.name,
          `${result.character.raceSummary} ${result.character.classSummary} • Lvl ${result.character.level}`,
        ]
      : [searchHitTypeLabel(result.hit.type), result.hit.name, hitMeta(result.hit)];

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
        <span className="block truncate text-[11px] text-muted">
          {meta}
          {!opens && " • No page yet"}
        </span>
      </span>
      <Tag>{chip}</Tag>
    </div>
  );
}

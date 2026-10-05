import type { SearchHit } from "@dnd/catalog";
import { SourceChip } from "../../components/SourceChip.tsx";
import { TypeChip } from "../../components/TypeChip.tsx";
import { searchHitAddress, searchHitTypeLabel } from "../../lib/searchHits.ts";

const row = "flex items-center gap-3 rounded-control border border-border bg-surface px-3.5 py-2.5";

/**
 * One compendium hit on the search page: its type, its name opening its detail, and where it
 * comes from. A hit the web shows no detail for names itself in plain text.
 */
export function SearchHitRow({
  hit,
  onOpen,
}: {
  hit: SearchHit;
  onOpen: (address: string) => void;
}) {
  const address = searchHitAddress(hit);
  const label = searchHitTypeLabel(hit.type);
  return (
    <li className={row}>
      <TypeChip type={hit.type}>{label}</TypeChip>
      <span className="min-w-0 grow">
        {address === undefined ? (
          <span className="block truncate text-body font-medium text-ink">
            {hit.name}
            <span className="ml-2 text-label font-normal text-muted">No page yet</span>
          </span>
        ) : (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => onOpen(address)}
            className="block max-w-full cursor-pointer truncate text-left text-body font-semibold text-accent-text hover:underline"
          >
            {hit.name}
          </button>
        )}
      </span>
      <SourceChip
        source={"source" in hit ? hit.source : undefined}
        edition={hit.edition}
        of={label.toLowerCase()}
      />
    </li>
  );
}

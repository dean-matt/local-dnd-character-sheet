import type { SearchHit } from "@dnd/catalog";
import { AddTo } from "../../components/AddTo/AddTo.tsx";
import { SourceChip } from "../../components/SourceChip.tsx";
import { TypeChip } from "../../components/TypeChip.tsx";
import type { AddOutcome } from "../../hooks/useAddToCharacter.ts";
import { addableHit } from "../../lib/addable.ts";
import { displayName } from "../../lib/displayName.ts";
import { itemMeta } from "../../lib/itemKind.ts";
import { searchHitAddress, searchHitTypeLabel } from "../../lib/searchHits.ts";

const row = "flex items-center gap-3 rounded-control border border-border bg-surface px-3.5 py-2.5";

/**
 * One compendium hit on the search page: its type, its name opening its detail, an item's kind
 * and rarity or a deity's pantheon or a card's deck beneath, and where it comes from. A hit the web shows no detail for names itself
 * in plain text. An item, a spell or a feat ends on "Add to…".
 */
export function SearchHitRow({
  hit,
  onOpen,
  onAdded,
}: {
  hit: SearchHit;
  onOpen: (address: string) => void;
  onAdded: (outcome: AddOutcome) => void;
}) {
  const address = searchHitAddress(hit);
  const addable = addableHit(hit);
  const label = searchHitTypeLabel(hit.type);
  return (
    <li className={row}>
      <TypeChip type={hit.type}>{label}</TypeChip>
      <span className="min-w-0 grow">
        {address === undefined ? (
          <span className="block truncate text-body font-medium text-ink">
            {displayName(hit.name)}
            <span className="ml-2 text-label font-normal text-muted">No page yet</span>
          </span>
        ) : (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => onOpen(address)}
            className="block max-w-full cursor-pointer truncate text-left text-body font-medium text-ink hover:underline"
          >
            {displayName(hit.name)}
          </button>
        )}
        {hit.item && (
          <span className="block truncate text-label text-muted">{itemMeta(hit.item)}</span>
        )}
        {"qualifier" in hit && hit.qualifier && (
          <span className="block truncate text-label text-muted">{hit.qualifier}</span>
        )}
      </span>
      <SourceChip
        source={"source" in hit ? hit.source : undefined}
        edition={hit.edition}
        of={label.toLowerCase()}
      />
      {addable && <AddTo row={addable} onAdded={onAdded} />}
    </li>
  );
}

/**
 * The advanced search: a query, a rail of filters, and a page of results from the user's
 * characters and the compendium. The query and every filter live in the URL. With a type
 * or source picked and no query, it lists every row they admit, which makes it the catalog
 * browse.
 */
import { Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useSearchParams } from "react-router";
import { CatalogDetail } from "../../components/CatalogDetail.tsx";
import { SEARCH_DEBOUNCE_MS, useCatalogSearch } from "../../hooks/useCatalogSearch.ts";
import { useCharacters } from "../../hooks/useCharacters.ts";
import { useDebounce } from "../../hooks/useDebounce.ts";
import { useReturnFocus } from "../../hooks/useReturnFocus.ts";
import { searchHitKey } from "../../lib/searchHits.ts";
import { SidebarFrame } from "../SidebarFrame.tsx";
import { CharacterResultRow } from "./CharacterResultRow.tsx";
import { SearchFilterPanel } from "./SearchFilterPanel.tsx";
import { SearchHitRow } from "./SearchHitRow.tsx";
import {
  CLEARED_FILTERS,
  narrowingParams,
  readSearchFilters,
  type SearchFilters,
  writeSearchFilters,
} from "./searchFilters.ts";

const PAGE_SIZE = 50;

const counted = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/**
 * The line under the search box, and whether it reports a failure. One branch decides both:
 * the box empties at once while the debounced query still holds a failed search.
 */
function searchStatus(s: {
  browsing: boolean;
  error: Error | null;
  pending: boolean;
  settled: boolean;
  q: string;
  total: number;
  characters: number;
}): { text: string; failed: boolean } {
  if (s.q === "" && !s.browsing)
    return {
      text: "Type a name to search the compendium, or pick a type or source.",
      failed: false,
    };
  if (s.error) return { text: `Search failed: ${s.error.message}`, failed: true };
  if (s.pending || !s.settled) return { text: "Searching…", failed: false };
  if (s.total + s.characters === 0) {
    const text =
      s.q === ""
        ? "Nothing matches these filters."
        : `No results for "${s.q}" under these filters.`;
    return { text, failed: false };
  }
  // Characters count apart, so the total agrees with the pager's.
  const text =
    s.characters === 0
      ? counted(s.total, "result")
      : `${counted(s.total, "result")} and ${counted(s.characters, "character")}`;
  return { text, failed: false };
}

const pageButton =
  "rounded-control border border-border bg-surface px-3 py-1.5 text-row font-medium text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50";

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const filters = readSearchFilters(params);
  const [detail, setDetail] = useState<string | undefined>(undefined);
  const opener = useReturnFocus<HTMLElement>(detail !== undefined);
  const characters = useCharacters();
  const id = useId();

  const q = filters.q.trim();
  const query = useDebounce(q, SEARCH_DEBOUNCE_MS);
  const browsing = filters.types.length > 0 || filters.sources.length > 0;
  const search = useCatalogSearch({
    edition: filters.edition,
    type: filters.types.length > 0 ? filters.types.join(",") : undefined,
    query,
    keepPrevious: true,
    limit: PAGE_SIZE,
    offset: filters.offset,
    listAll: browsing,
    filters: narrowingParams(filters),
  });

  // A type or source filter narrows to the compendium, where a character has neither.
  const characterResults =
    query !== "" && !browsing && filters.offset === 0
      ? (characters.data ?? []).filter(
          (c) =>
            c.name.toLowerCase().includes(query.toLowerCase()) &&
            (filters.edition === undefined || c.edition === filters.edition),
        )
      : [];
  const hits = search.data?.items ?? [];
  const total = search.data?.total ?? 0;
  const count = total + characterResults.length;
  // The last page stays up while the next loads, and nothing may read it as the new answer.
  const settled = query === q && !search.isPlaceholderData;

  const update = (next: Partial<SearchFilters>, replace = false) =>
    setParams(writeSearchFilters({ ...filters, offset: 0, ...next }), { replace });

  // A link whose offset runs past the last page, as a stale one can, moves back to that page.
  const pastEnd = settled && total > 0 && filters.offset >= total;
  useEffect(() => {
    if (pastEnd) update({ offset: Math.floor((total - 1) / PAGE_SIZE) * PAGE_SIZE }, true);
  });

  const status = searchStatus({
    browsing,
    error: search.error,
    pending: search.isPending,
    settled,
    q,
    total,
    characters: characterResults.length,
  });

  const empty = settled && search.isSuccess && count === 0;
  const filtered = writeSearchFilters({ ...filters, q: "", offset: 0 }).size > 0;
  const first = filters.offset + 1;
  const last = Math.min(filters.offset + PAGE_SIZE, total);

  return (
    <SidebarFrame
      label="Search filters"
      rail={<SearchFilterPanel filters={filters} onChange={update} />}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-4 px-gutter py-6">
        <h1 className="text-xl font-bold text-ink">Search</h1>
        <div className="flex items-center gap-2.5 rounded-pill border border-border bg-surface px-4 py-2.5 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent">
          <Search size={15} aria-hidden className="shrink-0 text-muted" />
          <label htmlFor={`${id}-query`} className="sr-only">
            Search the compendium
          </label>
          <input
            id={`${id}-query`}
            type="search"
            autoComplete="off"
            placeholder="Search spells, items, feats, rules…"
            value={filters.q}
            onChange={(event) => update({ q: event.target.value }, true)}
            className="min-w-0 grow bg-transparent text-body text-ink focus-visible:outline-none!"
          />
        </div>

        <p
          aria-hidden
          data-failed={status.failed}
          className="text-row text-muted data-[failed=true]:text-error"
        >
          {status.text}
        </p>
        {/* Rendered even while empty: a live region added with its text is often not announced. */}
        <p role="status" className="sr-only">
          {status.text}
        </p>

        {(characterResults.length > 0 || hits.length > 0) && (
          <ul aria-label="Results" className="flex flex-col gap-2">
            {characterResults.map((character) => (
              <CharacterResultRow key={character.id} character={character} />
            ))}
            {hits.map((hit) => (
              <SearchHitRow
                key={searchHitKey(hit)}
                hit={hit}
                onOpen={(address) => {
                  opener.current = document.activeElement as HTMLElement | null;
                  setDetail(address);
                }}
              />
            ))}
          </ul>
        )}

        {empty && filtered && (
          <button
            type="button"
            onClick={() => update(CLEARED_FILTERS)}
            className={`${pageButton} self-start`}
          >
            Reset filters
          </button>
        )}

        {total > PAGE_SIZE && (
          <nav aria-label="Result pages" className="flex items-center gap-3">
            <button
              type="button"
              disabled={filters.offset === 0}
              onClick={() => update({ offset: Math.max(0, filters.offset - PAGE_SIZE) })}
              className={pageButton}
            >
              Previous
            </button>
            <span className="text-row text-muted">
              {first}–{last} of {total}
            </span>
            <button
              type="button"
              disabled={last >= total}
              onClick={() => update({ offset: filters.offset + PAGE_SIZE })}
              className={pageButton}
            >
              Next
            </button>
          </nav>
        )}
      </div>

      {detail !== undefined && (
        <CatalogDetail address={detail} onClose={() => setDetail(undefined)} />
      )}
    </SidebarFrame>
  );
}

/**
 * The advanced search: a query, a rail of filters, and a page of results from the user's
 * characters and the compendium. The query and every filter live in the URL. With a type
 * or source picked and no query, it lists every row they admit, which makes it the catalog
 * browse.
 */
import { Search } from "lucide-react";
import { useId, useState } from "react";
import { useSearchParams } from "react-router";
import { CatalogDetail } from "../../components/CatalogDetail.tsx";
import { useCatalogSearch } from "../../hooks/useCatalogSearch.ts";
import { useCharacters } from "../../hooks/useCharacters.ts";
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
  const browsing = filters.types.length > 0 || filters.sources.length > 0;
  const search = useCatalogSearch({
    edition: filters.edition,
    type: filters.types.length > 0 ? filters.types.join(",") : undefined,
    query: q,
    limit: PAGE_SIZE,
    offset: filters.offset,
    listAll: browsing,
    filters: narrowingParams(filters),
  });

  // A type or source filter narrows to the compendium, where a character has neither.
  const characterResults =
    q !== "" && !browsing && filters.offset === 0
      ? (characters.data ?? []).filter(
          (c) =>
            c.name.toLowerCase().includes(q.toLowerCase()) &&
            (filters.edition === undefined || c.edition === filters.edition),
        )
      : [];
  const hits = search.data?.items ?? [];
  const total = search.data?.total ?? 0;
  const count = total + characterResults.length;
  const counted = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

  const update = (next: Partial<SearchFilters>, replace = false) =>
    setParams(writeSearchFilters({ ...filters, offset: 0, ...next }), { replace });

  function status(): string {
    if (q === "" && !browsing)
      return "Type a name to search the compendium, or pick a type or source.";
    if (search.isError) return `Search failed: ${search.error.message}`;
    if (search.isPending) return "Searching…";
    if (count === 0) {
      return q === ""
        ? "Nothing matches these filters."
        : `No results for "${q}" under these filters.`;
    }
    // Characters count apart, so the total agrees with the pager's.
    return characterResults.length === 0
      ? counted(total, "result")
      : `${counted(total, "result")} and ${counted(characterResults.length, "character")}`;
  }

  const empty = search.isSuccess && count === 0;
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

        <p aria-hidden className="text-row text-muted">
          {status()}
        </p>
        {/* Rendered even while empty: a live region added with its text is often not announced. */}
        <p role="status" className="sr-only">
          {status()}
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

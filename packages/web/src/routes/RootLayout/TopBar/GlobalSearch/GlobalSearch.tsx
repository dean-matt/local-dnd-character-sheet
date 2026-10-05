/**
 * The top bar's search across the user's characters and the compendium. Characters match
 * by name in the list the bar already holds; the compendium is `/search` over both
 * editions. A character result opens its sheet; a compendium result opens its detail in a
 * modal over the current page, and closing it returns focus to the search with the query
 * kept. A result with no detail stays in the list, reachable by arrow so a screen reader
 * hears it, and Enter or a click on it does nothing. Below the results, a link carries the
 * query to the advanced search page.
 */
import { Search, X } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CatalogDetail } from "../../../../components/CatalogDetail.tsx";
import { SEARCH_DEBOUNCE_MS, useCatalogSearch } from "../../../../hooks/useCatalogSearch.ts";
import { useCharacters } from "../../../../hooks/useCharacters.ts";
import { useDebounce } from "../../../../hooks/useDebounce.ts";
import { useReturnFocus } from "../../../../hooks/useReturnFocus.ts";
import { searchHitAddress, searchHitKey } from "../../../../lib/searchHits.ts";
import { SearchResultOption } from "./SearchResultOption.tsx";
import type { SearchResult } from "./searchResult.ts";

const RESULT_LIMIT = 10;

export interface GlobalSearchProps {
  /** Called as the search takes focus, so the bar can close an open menu. */
  onOpen: () => void;
}

const groupLabel = "px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-label text-muted";

export function GlobalSearch({ onOpen }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | undefined>(undefined);
  const characters = useCharacters();
  const debounced = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const compendium = useCatalogSearch({
    query: debounced,
    limit: RESULT_LIMIT,
    keepPrevious: true,
  });
  const navigate = useNavigate();
  const inputRef = useReturnFocus<HTMLInputElement>(detail !== undefined);
  const id = useId();
  const listboxId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const q = query.trim().toLowerCase();
  const characterResults: SearchResult[] = q
    ? (characters.data ?? [])
        .filter((c) => c.name.toLowerCase().includes(q))
        .map((c) => ({ key: `character:${c.id}`, character: c }))
    : [];
  const compendiumResults: SearchResult[] = (compendium.data?.items ?? []).map((hit) => ({
    key: searchHitKey(hit),
    address: searchHitAddress(hit),
    hit,
  }));
  const results = [...characterResults, ...compendiumResults];
  const showPanel = open && q.length > 0;
  // Held by key, so a late edition's hits re-sorting the list leave the highlight on its row.
  const activeIndex = showPanel ? results.findIndex((result) => result.key === active) : -1;

  function pick(result: SearchResult) {
    if (!("character" in result)) {
      if (result.address !== undefined) setDetail(result.address);
      return;
    }
    navigate(`/characters/${result.character.id}`);
    setOpen(false);
    setQuery("");
    setActive(null);
  }

  function move(step: 1 | -1) {
    setOpen(true);
    if (results.length === 0) return;
    const from = activeIndex === -1 ? (step === 1 ? -1 : 0) : activeIndex;
    setActive(results[(from + step + results.length) % results.length]?.key ?? null);
  }

  function dismiss() {
    if (open) setOpen(false);
    else setQuery("");
    setActive(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const result = results[activeIndex];
    if (event.key === "ArrowDown") move(1);
    else if (event.key === "ArrowUp") move(-1);
    else if (event.key === "Enter" && showPanel) {
      if (result) pick(result);
    } else if (event.key === "Escape") dismiss();
    else return;
    event.preventDefault();
  }

  function status(): string | undefined {
    if (compendium.error) return `Search failed: ${compendium.error.message}`;
    if (results.length > 0) return undefined;
    // An answer to the last query, kept up or not yet replaced, says nothing of this one.
    const settled = debounced === query && !compendium.isPlaceholderData;
    return settled && compendium.isSuccess ? `No results for "${query.trim()}".` : "Searching…";
  }

  const group = (label: string, rows: SearchResult[], offset: number) =>
    rows.length > 0 && (
      // biome-ignore lint/a11y/useSemanticElements: a listbox groups its options with role="group"; <fieldset> groups form controls.
      <div role="group" aria-label={label}>
        <p aria-hidden className={groupLabel}>
          {label}
        </p>
        {rows.map((result, i) => (
          <SearchResultOption
            key={result.key}
            id={optionId(offset + i)}
            result={result}
            active={offset + i === activeIndex}
            onPick={() => pick(result)}
            onPoint={() => setActive(result.key)}
          />
        ))}
      </div>
    );

  return (
    <>
      {open && (
        <div
          aria-hidden
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-scrim"
        />
      )}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: focusout and Escape bubbling from the input and the Advanced search link; only focus leaving the wrapper closes the panel, so Tab reaches the link. */}
      <div
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
        onKeyDown={(event) => {
          // The input handles its own Escape; from the Advanced search link, close and go back to it.
          if (event.key !== "Escape" || event.target === inputRef.current) return;
          inputRef.current?.focus();
          setOpen(false);
          setActive(null);
        }}
        className="absolute top-1/2 left-1/2 z-45 w-120 max-w-[40vw] -translate-x-1/2 -translate-y-1/2"
      >
        <div
          className={`flex items-center gap-2.5 rounded-pill border px-3.5 py-2 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-accent has-[input:focus-visible]:outline-offset-2 ${open ? "border-accent bg-surface" : "border-border bg-subtle"}`}
        >
          <Search size={15} aria-hidden className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            autoComplete="off"
            aria-label="Search characters and the compendium"
            aria-autocomplete="list"
            aria-expanded={showPanel && results.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex === -1 ? undefined : optionId(activeIndex)}
            placeholder="Search characters, spells, items, rules…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActive(null);
            }}
            onFocus={() => {
              setOpen(true);
              onOpen();
            }}
            onKeyDown={handleKeyDown}
            className="min-w-0 grow bg-transparent text-body text-ink focus-visible:outline-none! [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuery("");
                setActive(null);
                inputRef.current?.focus();
              }}
              className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-border text-ink"
            >
              <X size={10} strokeWidth={3} aria-hidden />
            </button>
          )}
        </div>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: a mousedown on a row or the scrollbar is cancelled so it never blurs the input, which closes the panel. */}
        <div
          hidden={!showPanel}
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-full right-0 left-0 mt-2 flex max-h-105 flex-col rounded-xl border border-border bg-surface p-2 shadow-popover"
        >
          {/* The results scroll alone, so the Advanced search link below stays in view. */}
          <div
            id={listboxId}
            role="listbox"
            aria-label="Search results"
            hidden={results.length === 0}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {group("Characters", characterResults, 0)}
            {group("Compendium", compendiumResults, characterResults.length)}
          </div>
          <p aria-hidden className="shrink-0 px-2.5 py-1.5 text-body text-muted empty:hidden">
            {showPanel ? status() : undefined}
          </p>
          <div className="mt-1 shrink-0 border-t border-border pt-1">
            <Link
              to={`/search?${new URLSearchParams({ q: query.trim() })}`}
              onClick={() => {
                setOpen(false);
                setQuery("");
                setActive(null);
              }}
              className="block rounded-lg px-2.5 py-1.5 text-row font-semibold text-accent-text hover:bg-subtle"
            >
              Advanced search for "{query.trim()}" →
            </Link>
          </div>
        </div>
      </div>
      {detail !== undefined && (
        <CatalogDetail address={detail} onClose={() => setDetail(undefined)} />
      )}
      {/* Mounted outside the hidden panel, so a screen reader hears each change of text. */}
      <p role="status" className="sr-only">
        {showPanel ? status() : undefined}
      </p>
    </>
  );
}

/**
 * The top bar's search across the user's characters and the compendium. Characters match
 * by name in the list the bar already holds; the compendium is `/search` over both
 * editions. A result with no detail route stays in the list, reachable by arrow so a
 * screen reader hears it, and Enter or a click on it does nothing.
 */
import { Search, X } from "lucide-react";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useCharacters } from "../../../../hooks/useCharacters.ts";
import { useCompendiumSearch } from "../../../../hooks/useCompendiumSearch.ts";
import { searchHitPath } from "../../../../lib/searchHits.ts";
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
  const [active, setActive] = useState(-1);
  const characters = useCharacters();
  const compendium = useCompendiumSearch(query, RESULT_LIMIT);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const listboxId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const q = query.trim().toLowerCase();
  const characterResults: SearchResult[] = q
    ? (characters.data ?? [])
        .filter((c) => c.name.toLowerCase().includes(q))
        .map((c) => ({ key: `character:${c.id}`, path: `/characters/${c.id}`, character: c }))
    : [];
  const compendiumResults: SearchResult[] = compendium.hits.map((hit) => ({
    key: "id" in hit ? `homebrew:${hit.type}:${hit.id}` : `${hit.type}|${hit.name}|${hit.source}`,
    path: searchHitPath(hit),
    hit,
  }));
  const results = [...characterResults, ...compendiumResults];
  const showPanel = open && q.length > 0;
  const activeIndex = showPanel && active < results.length ? active : -1;

  function pick(result: SearchResult) {
    if (result.path === undefined) return;
    navigate(result.path);
    setQuery("");
    setActive(-1);
  }

  function move(step: 1 | -1) {
    setOpen(true);
    if (results.length === 0) return;
    const from = activeIndex === -1 ? (step === 1 ? -1 : 0) : activeIndex;
    setActive((from + step + results.length) % results.length);
  }

  function dismiss() {
    if (open) setOpen(false);
    else setQuery("");
    setActive(-1);
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
    return compendium.settled ? `No results for "${query.trim()}".` : "Searching…";
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
            onPoint={() => setActive(offset + i)}
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
      <div className="absolute top-1/2 left-1/2 z-45 w-120 max-w-[40vw] -translate-x-1/2 -translate-y-1/2">
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
              setActive(-1);
            }}
            onFocus={() => {
              setOpen(true);
              onOpen();
            }}
            onBlur={() => setOpen(false)}
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
                setActive(-1);
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
          className="absolute top-full right-0 left-0 mt-2 max-h-105 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-popover"
        >
          <div
            id={listboxId}
            role="listbox"
            aria-label="Search results"
            hidden={results.length === 0}
          >
            {group("Characters", characterResults, 0)}
            {group("Compendium", compendiumResults, characterResults.length)}
          </div>
          <p role="status" className="px-2.5 py-1.5 text-body text-muted empty:hidden">
            {showPanel ? status() : undefined}
          </p>
        </div>
      </div>
    </>
  );
}

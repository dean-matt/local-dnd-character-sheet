/**
 * The one control that picks a catalog or homebrew row: a combobox over `/search`, for a
 * spell, an item, a feat or any other kind the caller names. It hands back a reference —
 * `(name, source)` or a homebrew id — and never the row, so a caller cannot copy one into a
 * character.
 *
 * A deity's pantheon or a card's deck shows beside its name, since two rows can share the
 * rest of their key, and `describe` adds a line the caller writes, such as what a row grants.
 *
 * Whether a row may be picked belongs to the caller, through `unavailableReason`. An
 * unavailable row stays in the list with its reason, reachable by arrow so a screen reader
 * hears why, and Enter or a click on it does nothing.
 */
import type { SearchHit } from "@dnd/catalog";
import type { CharacterRecord, EntryRef } from "@dnd/character";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useCatalogSearch } from "../../hooks/useCatalogSearch.ts";
import { useTopLayer } from "../../hooks/useTopLayer.ts";
import { ANCHORED_LIST_CLASSES, anchoredListStyle, anchorName } from "../../lib/anchoring.ts";
import { FormField } from "../FormField.tsx";
import { CatalogPickerOption } from "./CatalogPickerOption.tsx";

// An unavailable row still counts against this bound, so a broad query can fill the page
// with rows the caller rejects. The way out is a narrowing filter on `/search`, passed
// through `filters`.
const RESULT_LIMIT = 20;

export interface CatalogPickerProps {
  label: string;
  edition: CharacterRecord["edition"];
  /** The one kind of row offered, such as `spell` or `feat`. */
  type: string;
  /** Any further `/search` parameter narrowing the rows offered, such as an item `kind`. */
  filters?: Record<string, string>;
  /** Why `hit` cannot be picked here, or `undefined` where it can. */
  unavailableReason?: (hit: SearchHit) => string | undefined;
  /** A line under `hit`'s name, or `undefined` for none. */
  describe?: (hit: SearchHit) => string | undefined;
  /** `hit` carries what a reference does not, such as a deity's pantheon. */
  onPick: (ref: EntryRef, hit: SearchHit) => void;
  placeholder?: string;
  /** Moves focus to the input on mount, as where a cleared choice gave way to it. */
  focusOnMount?: boolean;
}

function toRef(hit: SearchHit): EntryRef {
  return "id" in hit ? { homebrewId: hit.id } : { name: hit.name, source: hit.source };
}

function boundText(shown: number, total: number): string {
  if (total === 0) return "No matches";
  if (shown < total) return `Showing ${shown} of ${total} matches — keep typing to narrow`;
  return total === 1 ? "1 match" : `${total} matches`;
}

function statusText(showList: boolean, searching: boolean, shown: number, total: number) {
  if (showList) return boundText(shown, total);
  return searching ? "Searching…" : undefined;
}

export function CatalogPicker({
  label,
  edition,
  type,
  filters,
  unavailableReason,
  describe,
  onPick,
  placeholder,
  focusOnMount = false,
}: CatalogPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: focus moves once, on mount.
  useEffect(() => {
    if (focusOnMount) input.current?.focus();
  }, []);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // An open picker with no text lists every row, so a player can browse before typing.
  const search = useCatalogSearch({
    edition,
    type,
    query,
    limit: RESULT_LIMIT,
    listAll: open,
    filters,
  });
  const id = useId();
  const listboxId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const hits = search.data?.items ?? [];
  const showList = open && search.data !== undefined;
  const activeIndex = showList && active < hits.length ? active : -1;
  const listShown = showList && hits.length > 0;
  const anchor = anchorName(id);
  useTopLayer(list, listShown);

  function pick(hit: SearchHit) {
    if (unavailableReason?.(hit) !== undefined) return;
    onPick(toRef(hit), hit);
    setQuery("");
    setOpen(false);
    setActive(-1);
  }

  function move(step: 1 | -1) {
    setOpen(true);
    if (hits.length === 0) return;
    const from = activeIndex === -1 ? (step === 1 ? -1 : 0) : activeIndex;
    setActive((from + step + hits.length) % hits.length);
  }

  function dismiss() {
    if (open) setOpen(false);
    else setQuery("");
    setActive(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const hit = hits[activeIndex];
    if (event.key === "ArrowDown") move(1);
    else if (event.key === "ArrowUp") move(-1);
    else if (event.key === "Enter" && showList) {
      // Cancelled even with no row active, so Enter never submits an enclosing form.
      if (hit) pick(hit);
    } else if (event.key === "Escape") dismiss();
    else return;
    event.preventDefault();
  }

  return (
    <FormField
      label={label}
      status={statusText(showList, open && search.isFetching, hits.length, search.data?.total ?? 0)}
      error={search.isError && `Search failed: ${search.error.message}`}
    >
      {(control) => (
        <div className="flex flex-col gap-1">
          <input
            {...control}
            ref={input}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={listShown}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex === -1 ? undefined : optionId(activeIndex)}
            placeholder={placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            style={{ anchorName: anchor }}
            className="rounded-control border border-border bg-surface px-2 py-1"
          />
          {/* A mousedown on a row or the scrollbar is cancelled so it never blurs the input,
              which closes the list. */}
          <div
            ref={list}
            id={listboxId}
            role="listbox"
            onMouseDown={(event) => event.preventDefault()}
            aria-label={label}
            hidden={!listShown}
            style={anchoredListStyle(anchor)}
            className={`${ANCHORED_LIST_CLASSES} overflow-y-auto rounded-card border border-border bg-surface p-1 shadow-popover`}
          >
            {hits.map((hit, index) => (
              <CatalogPickerOption
                key={
                  "id" in hit
                    ? `homebrew:${hit.id}`
                    : `${hit.name}|${hit.source}|${hit.qualifier ?? ""}`
                }
                id={optionId(index)}
                hit={hit}
                reason={unavailableReason?.(hit)}
                detail={describe?.(hit)}
                active={index === activeIndex}
                onPick={() => pick(hit)}
                onPoint={() => setActive(index)}
              />
            ))}
          </div>
        </div>
      )}
    </FormField>
  );
}

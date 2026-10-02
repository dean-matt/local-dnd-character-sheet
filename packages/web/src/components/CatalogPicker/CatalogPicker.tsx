/**
 * The one control that picks a catalog or homebrew row: a combobox over `/search`, for a
 * spell, an item, a feat or any other kind the caller names. It hands back a reference —
 * `(name, source)` or a homebrew id — and never the row, so a caller cannot copy one into a
 * character.
 *
 * Whether a row may be picked belongs to the caller, through `unavailableReason`. An
 * unavailable row stays in the list with its reason, reachable by arrow so a screen reader
 * hears why, and Enter or a click on it does nothing.
 */
import type { SearchHit } from "@dnd/catalog";
import type { CharacterRecord, EntryRef } from "@dnd/character";
import { type KeyboardEvent, useId, useState } from "react";
import { useCatalogSearch } from "../../hooks/useCatalogSearch.ts";
import { FormField } from "../FormField.tsx";
import { CatalogPickerOption } from "./CatalogPickerOption.tsx";

const RESULT_LIMIT = 20;

export interface CatalogPickerProps {
  label: string;
  edition: CharacterRecord["edition"];
  /** The one kind of row offered, such as `spell` or `feat`. */
  type: string;
  /** Why `hit` cannot be picked here, or `undefined` where it can. */
  unavailableReason?: (hit: SearchHit) => string | undefined;
  onPick: (ref: EntryRef) => void;
  placeholder?: string;
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
  unavailableReason,
  onPick,
  placeholder,
}: CatalogPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const search = useCatalogSearch({ edition, type, query, limit: RESULT_LIMIT });
  const id = useId();
  const listboxId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const hits = search.data?.items ?? [];
  const showList = open && query.trim().length > 0 && search.data !== undefined;
  const activeIndex = showList && active < hits.length ? active : -1;

  function pick(hit: SearchHit) {
    if (unavailableReason?.(hit) !== undefined) return;
    onPick(toRef(hit));
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
    if (showList) setOpen(false);
    else setQuery("");
    setActive(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const hit = hits[activeIndex];
    if (event.key === "ArrowDown") move(1);
    else if (event.key === "ArrowUp") move(-1);
    else if (event.key === "Enter" && hit) pick(hit);
    else if (event.key === "Escape") dismiss();
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
            type="text"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={showList}
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
            onBlur={() => setOpen(false)}
            className="rounded-control border border-border bg-surface px-2 py-1"
          />
          <div
            id={listboxId}
            role="listbox"
            aria-label={label}
            hidden={!showList || hits.length === 0}
            className="max-h-64 overflow-y-auto rounded-card border border-border bg-surface p-1 shadow-popover"
          >
            {hits.map((hit, index) => (
              <CatalogPickerOption
                key={"id" in hit ? `homebrew:${hit.id}` : `${hit.name}|${hit.source}`}
                id={optionId(index)}
                hit={hit}
                reason={unavailableReason?.(hit)}
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

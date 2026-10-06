import { useId, useState } from "react";
import { ErrorState } from "../../ErrorState.tsx";
import { useCatalogSources } from "../../hooks/useCatalogSources.ts";
import { useDisabledSources } from "../../hooks/useDisabledSources.ts";
import { useSearchSources } from "../../hooks/useSearchSources.ts";
import { LoadingState } from "../../LoadingState.tsx";
import { setDisabledSources } from "../../lib/disabledSources.ts";
import { type SourceShelf, shelveSources } from "../../lib/sourceShelves.ts";
import { SourceBulkSwitches } from "./SourceBulkSwitches.tsx";
import { SourceGroupChips } from "./SourceGroupChips.tsx";

/**
 * One switch per source a search can return, turning its rows off in search and pickers,
 * under a group heading for each kind of book, with a filter, chips narrowing the list to
 * chosen groups, and switches for a whole group or everything the filter and chips show.
 */
export function SourcesSettings() {
  const { data, isPending, isError, error } = useSearchSources();
  const catalogSources = useCatalogSources();
  const catalog = catalogSources.data;
  const disabled = useDisabledSources();
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<SourceShelf["label"][]>([]);
  const id = useId();

  const toggle = (source: string) =>
    setDisabledSources(
      disabled.includes(source) ? disabled.filter((s) => s !== source) : [...disabled, source],
    );

  const groups = data ? shelveSources(data, catalog, "").map((shelf) => shelf.label) : [];
  const shelves = (data ? shelveSources(data, catalog, query) : []).filter(
    (shelf) => chosen.length === 0 || chosen.includes(shelf.label),
  );
  const shown = shelves.flatMap((shelf) => shelf.sources.map(({ source }) => source));
  const filtering = query.trim() !== "";
  const narrowing = filtering || chosen.length > 0;
  const countOf = (n: number) => (n === 1 ? "1 source matches" : `${n} sources match`);
  const matchCount = countOf(shown.length);
  const noMatch =
    chosen.length > 0
      ? `No source in the chosen groups matches “${query.trim()}”.`
      : `No source matches “${query.trim()}”.`;

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <div>
        <h1
          id={`${id}-title`}
          className="font-semibold text-label text-muted uppercase tracking-label"
        >
          Sources
        </h1>
        <p className="mt-1 text-label text-muted">
          Which sourcebooks show up in search and catalog pickers. Turning one off hides its rows
          there and leaves the synced catalog as it is.
        </p>
      </div>
      {(isPending || catalogSources.isPending) && <LoadingState label="Loading sources…" />}
      {isError && <ErrorState message={error.message} />}
      {data && !catalogSources.isPending && (
        <>
          {catalogSources.isError && (
            <p className="text-label text-error">
              Titles and groups did not load, so every source sits under Other.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor={`${id}-filter`} className="sr-only">
              Filter sources
            </label>
            <input
              id={`${id}-filter`}
              type="search"
              placeholder="Filter by abbreviation or title…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 rounded-control border border-border bg-surface px-3 py-2 text-body placeholder:text-muted"
            />
            {narrowing && shown.length > 0 && (
              <div className="flex items-center gap-3">
                <p id={`${id}-shown`} aria-hidden="true" className="text-label text-muted">
                  {matchCount}
                </p>
                <SourceBulkSwitches sources={shown} describedBy={`${id}-shown`} />
              </div>
            )}
          </div>
          <SourceGroupChips groups={groups} chosen={chosen} onChange={setChosen} />
          {/* Rendered even while empty: a live region added with its text is often not announced. */}
          <p role="status" aria-live="polite" className="sr-only">
            {narrowing ? (shown.length === 0 ? noMatch : matchCount) : ""}
          </p>
          {narrowing && shown.length === 0 && (
            <p aria-hidden="true" className="text-body text-muted italic">
              {noMatch}
            </p>
          )}
          {shelves.map((shelf, index) => (
            <section
              key={shelf.label}
              aria-labelledby={`${id}-shelf-${index}`}
              className="flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={`${id}-shelf-${index}`} className="font-semibold text-row">
                  {shelf.label}
                </h2>
                {filtering && (
                  <span id={`${id}-shelf-${index}-count`} hidden>
                    {countOf(shelf.sources.length)}
                  </span>
                )}
                <SourceBulkSwitches
                  sources={shelf.sources.map(({ source }) => source)}
                  describedBy={
                    filtering
                      ? `${id}-shelf-${index} ${id}-shelf-${index}-count`
                      : `${id}-shelf-${index}`
                  }
                />
              </div>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {shelf.sources.map(({ source, title }) => (
                  <li
                    key={source}
                    className="flex items-center justify-between gap-3 rounded-control bg-subtle px-3 py-2.5"
                  >
                    <div id={`${id}-${source}`} className="min-w-0">
                      <p className="font-semibold text-row">{source}</p>
                      {title && <p className="truncate text-label text-muted">{title}</p>}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!disabled.includes(source)}
                      aria-labelledby={`${id}-${source}`}
                      onClick={() => toggle(source)}
                      className="group relative h-5 w-9 shrink-0 rounded-full border border-border bg-muted aria-checked:bg-accent"
                    >
                      <span
                        aria-hidden="true"
                        className="absolute top-px left-px size-4 rounded-full bg-surface forced-colors:bg-[CanvasText] transition-transform group-aria-checked:translate-x-4"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </section>
  );
}

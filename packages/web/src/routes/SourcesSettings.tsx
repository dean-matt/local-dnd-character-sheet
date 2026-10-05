import { useId } from "react";
import { ErrorState } from "../ErrorState.tsx";
import { useDisabledSources } from "../hooks/useDisabledSources.ts";
import { useSearchSources } from "../hooks/useSearchSources.ts";
import { LoadingState } from "../LoadingState.tsx";
import { setDisabledSources } from "../lib/disabledSources.ts";

/** One switch per source a search can return, turning its rows off in search and pickers. */
export function SourcesSettings() {
  const { data, isPending, isError, error } = useSearchSources();
  const disabled = useDisabledSources();
  const id = useId();

  const toggle = (source: string) =>
    setDisabledSources(
      disabled.includes(source) ? disabled.filter((s) => s !== source) : [...disabled, source],
    );

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
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
      {isPending && <LoadingState label="Loading sources…" />}
      {isError && <ErrorState message={error.message} />}
      {data && (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {data.map(({ source, name }) => (
            <li
              key={source}
              className="flex items-center justify-between gap-3 rounded-control bg-subtle px-3 py-2.5"
            >
              <div id={`${id}-${source}`} className="min-w-0">
                <p className="font-semibold text-row">{source}</p>
                {name && <p className="truncate text-label text-muted">{name}</p>}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!disabled.includes(source)}
                aria-labelledby={`${id}-${source}`}
                onClick={() => toggle(source)}
                className="group relative h-5 w-9 shrink-0 rounded-full border border-border bg-border aria-checked:bg-accent"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-px left-px size-4 rounded-full bg-white transition-transform group-aria-checked:translate-x-4"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

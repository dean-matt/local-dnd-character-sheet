import type { CharacterRecord } from "@dnd/character";
import { useId } from "react";
import { Card } from "../../components/Card.tsx";
import { SourceSwitch } from "../../components/SourceSwitch.tsx";
import { useCatalogSources } from "../../hooks/useCatalogSources.ts";
import { useGlobalDisabledSources } from "../../hooks/useGlobalDisabledSources.ts";
import { useHeldSave } from "../../hooks/useHeldSave.ts";
import { useSearchSources } from "../../hooks/useSearchSources.ts";
import { shelveSources } from "../../lib/sourceShelves.ts";

/**
 * Which sources this character's pickers and searches offer, under the same shelves as
 * Settings. A switch narrows what Settings leaves on; a source Settings turned off reads
 * off and stays locked, since a character never widens it. Each switch saves on change, and
 * the last one back on clears the list, so the character follows Settings again.
 */
export function SourcesCard({ character }: { character: CharacterRecord }) {
  const write = useHeldSave(character.id, "Sources");
  const sources = useSearchSources();
  const titles = useCatalogSources();
  const global = useGlobalDisabledSources();
  const id = useId();
  const excluded = character.definition.excludedSources ?? [];

  const clear = () => write("sources", ({ excludedSources: _, ...latest }) => latest);
  const toggle = (source: string) =>
    write("sources", ({ excludedSources: current = [], ...latest }) => {
      const next = current.includes(source)
        ? current.filter((each) => each !== source)
        : [...current, source].sort();
      return { ...latest, ...(next.length > 0 && { excludedSources: next }) };
    });

  return (
    <Card
      title="Sources"
      aside={
        excluded.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-label text-muted underline hover:text-ink"
          >
            Follow Settings
          </button>
        )
      }
    >
      <p className="mb-2 text-muted text-row">
        {excluded.length > 0
          ? `${excluded.length} turned off for this character, on top of Settings.`
          : "Following the sources turned on in Settings."}
      </p>
      {sources.isPending && <p className="text-muted text-row">Loading sources…</p>}
      {sources.isError && (
        <p role="alert" className="text-error text-row">
          Sources did not load: {sources.error.message}
        </p>
      )}
      {sources.data && (
        <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
          {shelveSources(sources.data, titles.data, "").map((shelf, index) => (
            <section key={shelf.label} aria-labelledby={`${id}-shelf-${index}`}>
              <h4 id={`${id}-shelf-${index}`} className="mb-1 font-semibold text-row">
                {shelf.label}
              </h4>
              <ul className="flex flex-col gap-1.5">
                {shelf.sources.map(({ source, title }) => {
                  const off = global.includes(source);
                  return (
                    <li
                      key={source}
                      className="flex items-center justify-between gap-3 rounded-control bg-subtle px-3 py-2"
                    >
                      <div id={`${id}-${source}`} className="min-w-0">
                        <p className="font-semibold text-row">{source}</p>
                        {title && <p className="truncate text-label text-muted">{title}</p>}
                        {off && <p className="text-label text-muted">Off in Settings</p>}
                      </div>
                      <SourceSwitch
                        labelledBy={`${id}-${source}`}
                        checked={!off && !excluded.includes(source)}
                        locked={off}
                        onToggle={() => toggle(source)}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

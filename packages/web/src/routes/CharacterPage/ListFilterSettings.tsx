import { facetApplies, type ListFilter, type PageBlock } from "@dnd/character";
import { z } from "zod";
import { Field } from "../../components/Field/Field.tsx";
import { levelLabel } from "../../lib/spellLevel.ts";

type ListBlock = Extract<PageBlock, { kind: "list" }>;

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Drops a facet left empty, so the stored filter names only what narrows. */
function withFacet<K extends keyof ListFilter>(filter: ListFilter, facet: K, value: ListFilter[K]) {
  const { [facet]: _, ...rest } = filter;
  const empty = value === undefined || (Array.isArray(value) && value.length === 0);
  return empty ? rest : { ...rest, [facet]: value };
}

/**
 * The facets a `list` block narrows its source by, shown only where that source has them.
 * `onChange` takes a toggle; `onSave` takes the search text, which saves as it is typed.
 */
export function ListFilterSettings({
  block,
  onChange,
  onSave,
}: {
  block: ListBlock;
  onChange: (edit: (filter: ListFilter) => ListFilter) => void;
  onSave: (edit: (filter: ListFilter) => ListFilter) => Promise<void>;
}) {
  const { filter } = block;
  return (
    <div className="flex flex-col gap-2">
      <Field
        mode="edit"
        label="Name contains"
        current={filter.search ?? ""}
        format={(text) => text}
        parse={(raw) => raw.trim()}
        schema={z.string()}
        onSave={(search: string) =>
          onSave((latest) => withFacet(latest, "search", search || undefined))
        }
      />
      {facetApplies("prepared", block.source) && (
        <label className="flex items-center gap-2 text-ink text-row">
          <input
            type="checkbox"
            checked={filter.prepared === true}
            onChange={(event) => {
              const on = event.target.checked || undefined;
              onChange((latest) => withFacet(latest, "prepared", on));
            }}
          />
          Prepared only
        </label>
      )}
      {facetApplies("equipped", block.source) && (
        <label className="flex items-center gap-2 text-ink text-row">
          <input
            type="checkbox"
            checked={filter.equipped === true}
            onChange={(event) => {
              const on = event.target.checked || undefined;
              onChange((latest) => withFacet(latest, "equipped", on));
            }}
          />
          Equipped only
        </label>
      )}
      {facetApplies("levels", block.source) && (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-muted text-row">Spell levels (none means every level)</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {LEVELS.map((level) => (
              <label key={level} className="flex items-center gap-1.5 text-ink text-row">
                <input
                  type="checkbox"
                  checked={filter.levels?.includes(level) ?? false}
                  onChange={(event) => {
                    const on = event.target.checked;
                    onChange((latest) => {
                      const rest = (latest.levels ?? []).filter((each) => each !== level);
                      const levels = on ? [...rest, level].sort((a, b) => a - b) : rest;
                      return withFacet(latest, "levels", levels);
                    });
                  }}
                />
                {levelLabel(level)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

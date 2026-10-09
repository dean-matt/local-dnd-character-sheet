import { ChevronLeft, SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";
import { MultiSelect } from "../../components/MultiSelect.tsx";
import { useCatalogSources } from "../../hooks/useCatalogSources.ts";
import { useDisabledSources } from "../../hooks/useDisabledSources.ts";
import { useSearchSources } from "../../hooks/useSearchSources.ts";
import { useSearchTypes } from "../../hooks/useSearchTypes.ts";
import { EDITION_LABELS } from "../../lib/editionLabels.ts";
import { ITEM_KIND_OPTIONS } from "../../lib/itemKind.ts";
import { RARITIES } from "../../lib/rarities.ts";
import { searchHitTypePlural } from "../../lib/searchHits.ts";
import { SCHOOLS } from "../../lib/spellSchool.ts";
import {
  activeFilterCount,
  CLEARED_FILTERS,
  filtersAddedBy,
  itemsShown,
  MAX_SPELL_LEVEL,
  MIN_SPELL_LEVEL,
  type SearchFilters,
  spellsShown,
} from "./searchFilters.ts";

export interface SearchFilterPanelProps {
  filters: SearchFilters;
  /** Called with the filters to apply; the page keeps the query and starts again at the first page. */
  onChange: (next: Partial<SearchFilters>) => void;
}

const heading = "text-label font-semibold uppercase tracking-label text-muted";
const levelInput = "control w-14 text-ink";

/**
 * The search page's filter rail: type, source and edition, then spell level and school once
 * the types include spells, and rarity and kind once they include items. Collapsed, it shows a
 * filter icon, badged with how many filters are on, and the Expand toggle at the foot, either of
 * which opens it again.
 */
export function SearchFilterPanel({ filters, onChange }: SearchFilterPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const types = useSearchTypes();
  const sources = useSearchSources();
  const titles = useCatalogSources();
  const disabled = useDisabledSources();
  const id = useId();
  const active = activeFilterCount(filters);

  const typeOptions = (types.data ?? [])
    .map((type) => ({ value: type, label: searchHitTypePlural(type), hint: filtersAddedBy(type) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const sourceOptions = (sources.data ?? [])
    // A source Settings turned off still lists while a link has it chosen, so it can be unticked.
    .filter((source) => !disabled.includes(source) || filters.sources.includes(source))
    .map((source) => {
      const title = titles.data?.get(source)?.name;
      return { value: source, label: title ? `${source} · ${title}` : source, short: source };
    });
  const schoolOptions = Object.entries(SCHOOLS)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const editions = Object.keys(EDITION_LABELS) as (keyof typeof EDITION_LABELS)[];
  const editionShown = (edition: keyof typeof EDITION_LABELS) =>
    filters.edition === undefined || filters.edition === edition;
  // Unticking the one edition shown leaves neither, which reads as both rather than nothing.
  const toggleEdition = (edition: keyof typeof EDITION_LABELS) =>
    onChange({
      edition: filters.edition === undefined ? editions.find((e) => e !== edition) : undefined,
    });
  const level = (value: string) =>
    Math.min(MAX_SPELL_LEVEL, Math.max(MIN_SPELL_LEVEL, Number.parseInt(value, 10) || 0));

  return (
    <div
      className="flex h-full flex-col gap-5 overflow-y-auto border-r border-border bg-surface px-4 py-5"
      style={{
        width: collapsed ? "var(--spacing-sidebar-collapsed)" : "var(--spacing-sidebar)",
        transition: "width var(--duration-standard)",
      }}
    >
      {collapsed && (
        <button
          type="button"
          aria-label={active > 0 ? `Show filters (${active} on)` : "Show filters"}
          aria-expanded={false}
          onClick={() => setCollapsed(false)}
          className="relative flex justify-center rounded-control px-2.5 py-2.5 text-muted hover:bg-subtle"
        >
          <SlidersHorizontal size={16} aria-hidden />
          {active > 0 && (
            <span
              aria-hidden
              className="absolute top-0.5 right-1.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 font-semibold text-white"
            >
              {active}
            </span>
          )}
        </button>
      )}
      {!collapsed && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-title font-semibold text-ink">Filter results</h2>
            <button
              type="button"
              onClick={() => onChange(CLEARED_FILTERS)}
              className="rounded-control px-2 py-1 text-row font-semibold text-accent-text hover:bg-subtle"
            >
              Reset
            </button>
          </div>

          <MultiSelect
            label="Type"
            noun="types"
            options={typeOptions}
            selected={filters.types}
            onChange={(next) => onChange({ types: next })}
          />

          <MultiSelect
            label="Source"
            noun="sources"
            selected={filters.sources}
            options={sourceOptions}
            onChange={(next) => onChange({ sources: next })}
          />

          <fieldset>
            <legend className={`${heading} mb-2`}>Edition</legend>
            <div className="flex gap-4">
              {editions.map((edition) => (
                <label key={edition} className="flex items-center gap-2 text-row text-ink">
                  <input
                    type="checkbox"
                    checked={editionShown(edition)}
                    onChange={() => toggleEdition(edition)}
                  />
                  {EDITION_LABELS[edition]}
                </label>
              ))}
            </div>
          </fieldset>

          {spellsShown(filters) && (
            <>
              <fieldset>
                <legend className={`${heading} mb-2`}>Spell level</legend>
                <div className="flex items-center gap-2 text-row text-secondary">
                  <label htmlFor={`${id}-min`}>Min</label>
                  <input
                    id={`${id}-min`}
                    type="number"
                    min={MIN_SPELL_LEVEL}
                    max={MAX_SPELL_LEVEL}
                    value={filters.minLevel}
                    onChange={(event) => {
                      if (event.target.value === "") return;
                      const n = level(event.target.value);
                      onChange({ minLevel: n, maxLevel: Math.max(n, filters.maxLevel) });
                    }}
                    className={levelInput}
                  />
                  <label htmlFor={`${id}-max`}>Max</label>
                  <input
                    id={`${id}-max`}
                    type="number"
                    min={MIN_SPELL_LEVEL}
                    max={MAX_SPELL_LEVEL}
                    value={filters.maxLevel}
                    onChange={(event) => {
                      if (event.target.value === "") return;
                      const n = level(event.target.value);
                      onChange({ maxLevel: n, minLevel: Math.min(n, filters.minLevel) });
                    }}
                    className={levelInput}
                  />
                </div>
              </fieldset>
              <MultiSelect
                label="School"
                noun="schools"
                selected={filters.schools}
                options={schoolOptions}
                onChange={(next) => onChange({ schools: next })}
              />
            </>
          )}
          {itemsShown(filters) && (
            <>
              <MultiSelect
                label="Rarity"
                noun="rarities"
                selected={filters.rarities}
                options={RARITIES}
                onChange={(next) => onChange({ rarities: next })}
              />
              <MultiSelect
                label="Kind"
                noun="kinds"
                selected={filters.kinds}
                options={ITEM_KIND_OPTIONS}
                onChange={(next) => onChange({ kinds: next })}
              />
            </>
          )}
        </>
      )}

      <div className="flex-1" />

      <div className="border-t border-border pt-3">
        <button
          type="button"
          aria-label={collapsed ? "Expand filters" : "Collapse filters"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          className={`flex w-full items-center gap-3 rounded-control px-2.5 py-2.5 text-sm font-medium text-muted hover:bg-subtle ${collapsed ? "justify-center" : ""}`}
        >
          <ChevronLeft
            size={16}
            aria-hidden
            className="shrink-0"
            style={{
              transform: collapsed ? "rotate(180deg)" : undefined,
              transition: "transform var(--duration-standard)",
            }}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );
}

import { ChevronLeft } from "lucide-react";
import { useId, useState } from "react";
import { useCatalogSources } from "../../hooks/useCatalogSources.ts";
import { useDisabledSources } from "../../hooks/useDisabledSources.ts";
import { useSearchSources } from "../../hooks/useSearchSources.ts";
import { useSearchTypes } from "../../hooks/useSearchTypes.ts";
import { EDITION_LABELS } from "../../lib/editionLabels.ts";
import { ITEM_KIND_OPTIONS } from "../../lib/itemKind.ts";
import { searchHitTypeLabel } from "../../lib/searchHits.ts";
import { SCHOOLS } from "../../lib/spellSchool.ts";
import { SearchFacet } from "./SearchFacet.tsx";
import {
  CLEARED_FILTERS,
  itemsShown,
  MAX_SPELL_LEVEL,
  MIN_SPELL_LEVEL,
  type SearchFilters,
  spellsShown,
} from "./searchFilters.ts";

/** Each rarity upstream gives an item, as `/search` takes it, beside the label shown. */
const RARITIES = [
  { value: "common", label: "Common" },
  { value: "uncommon", label: "Uncommon" },
  { value: "rare", label: "Rare" },
  { value: "very rare", label: "Very rare" },
  { value: "legendary", label: "Legendary" },
  { value: "artifact", label: "Artifact" },
  { value: "varies", label: "Varies" },
  { value: "unknown", label: "Unknown" },
  { value: "unknown (magic)", label: "Unknown (magic)" },
  { value: "none", label: "None (mundane)" },
];

export interface SearchFilterPanelProps {
  filters: SearchFilters;
  /** Called with the filters to apply; the page keeps the query and starts again at the first page. */
  onChange: (next: Partial<SearchFilters>) => void;
}

const heading = "text-label font-semibold uppercase tracking-label text-muted";
const levelInput =
  "w-14 rounded-control border border-border bg-surface px-2 py-1.5 text-row text-ink";

const toggled = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/**
 * The search page's filter rail: type, source and edition, then spell level and school once
 * the types include spells, and rarity and kind once they include items. Collapsed, it shows its
 * toggle alone.
 */
export function SearchFilterPanel({ filters, onChange }: SearchFilterPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const types = useSearchTypes();
  const sources = useSearchSources();
  const titles = useCatalogSources();
  const disabled = useDisabledSources();
  const id = useId();

  const typeOptions = (types.data ?? [])
    .map((type) => ({ type, label: searchHitTypeLabel(type) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const sourceOptions = (sources.data ?? [])
    .filter((source) => !disabled.includes(source))
    .map((source) => {
      const title = titles.data?.get(source)?.name;
      return { value: source, label: title ? `${source} · ${title}` : source, chip: source };
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

          <fieldset>
            <legend className={`${heading} mb-2`}>Type</legend>
            <div className="flex flex-col gap-1.5">
              {typeOptions.map(({ type, label }) => (
                <label key={type} className="flex items-center gap-2 text-row text-ink">
                  <input
                    type="checkbox"
                    checked={filters.types.includes(type)}
                    onChange={() => onChange({ types: toggled(filters.types, type) })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <SearchFacet
            label="Source"
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
                      const n = level(event.target.value);
                      onChange({ maxLevel: n, minLevel: Math.min(n, filters.minLevel) });
                    }}
                    className={levelInput}
                  />
                </div>
              </fieldset>
              <SearchFacet
                label="School"
                selected={filters.schools}
                options={schoolOptions}
                onChange={(next) => onChange({ schools: next })}
              />
            </>
          )}
          {itemsShown(filters) && (
            <>
              <SearchFacet
                label="Rarity"
                selected={filters.rarities}
                options={RARITIES}
                onChange={(next) => onChange({ rarities: next })}
              />
              <SearchFacet
                label="Kind"
                selected={filters.kinds}
                options={ITEM_KIND_OPTIONS}
                onChange={(next) => onChange({ kinds: next })}
              />
            </>
          )}
          {!spellsShown(filters) && !itemsShown(filters) && (
            <p className="text-row text-muted italic">
              Tick Spell for level and school, or Item for rarity and kind.
            </p>
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

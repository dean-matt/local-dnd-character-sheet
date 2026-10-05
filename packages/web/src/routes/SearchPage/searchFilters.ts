/**
 * The search page's query and filters, read from and written to the URL under the names
 * `/search` takes, so a reload or a shared link restores the same search. A filter at its
 * default stays out of the URL, and the spell and item filters stay out unless the types
 * include spells or items, since they narrow nothing else.
 */
import type { CharacterRecord } from "@dnd/character";

type Edition = CharacterRecord["edition"];

export interface SearchFilters {
  q: string;
  types: string[];
  sources: string[];
  /** The one ruleset to show; absent shows both. */
  edition: Edition | undefined;
  minLevel: number;
  maxLevel: number;
  schools: string[];
  rarities: string[];
  offset: number;
}

export const MIN_SPELL_LEVEL = 0;
export const MAX_SPELL_LEVEL = 9;

/** Every filter at its default, which Reset applies and leaves the query as it is. */
export const CLEARED_FILTERS = {
  types: [],
  sources: [],
  edition: undefined,
  minLevel: MIN_SPELL_LEVEL,
  maxLevel: MAX_SPELL_LEVEL,
  schools: [],
  rarities: [],
} satisfies Partial<SearchFilters>;

const list = (value: string | null) => (value ? value.split(",").filter(Boolean) : []);

function level(value: string | null, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isNaN(n) ? fallback : Math.min(MAX_SPELL_LEVEL, Math.max(MIN_SPELL_LEVEL, n));
}

export const spellsShown = (filters: SearchFilters) => filters.types.includes("spell");
export const itemsShown = (filters: SearchFilters) => filters.types.includes("item");

export function readSearchFilters(params: URLSearchParams): SearchFilters {
  const edition = params.get("edition");
  const offset = Number.parseInt(params.get("offset") ?? "", 10);
  const levels = [
    level(params.get("minLevel"), MIN_SPELL_LEVEL),
    level(params.get("maxLevel"), MAX_SPELL_LEVEL),
  ];
  return {
    q: params.get("q") ?? "",
    types: list(params.get("type")),
    sources: list(params.get("source")),
    edition: edition === "classic" || edition === "one" ? edition : undefined,
    // A range written backwards, as a hand-edited link can, reads the right way round.
    minLevel: Math.min(...levels),
    maxLevel: Math.max(...levels),
    schools: list(params.get("school")),
    rarities: list(params.get("rarity")),
    offset: Number.isNaN(offset) || offset < 0 ? 0 : offset,
  };
}

/** The `/search` parameters the filters set beyond the query, edition, types and paging. */
export function narrowingParams(filters: SearchFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.sources.length > 0) params.source = filters.sources.join(",");
  if (spellsShown(filters)) {
    if (filters.minLevel !== MIN_SPELL_LEVEL) params.minLevel = String(filters.minLevel);
    if (filters.maxLevel !== MAX_SPELL_LEVEL) params.maxLevel = String(filters.maxLevel);
    if (filters.schools.length > 0) params.school = filters.schools.join(",");
  }
  if (itemsShown(filters) && filters.rarities.length > 0) {
    params.rarity = filters.rarities.join(",");
  }
  return params;
}

export function writeSearchFilters(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q !== "") params.set("q", filters.q);
  if (filters.types.length > 0) params.set("type", filters.types.join(","));
  if (filters.edition !== undefined) params.set("edition", filters.edition);
  for (const [key, value] of Object.entries(narrowingParams(filters))) params.set(key, value);
  if (filters.offset > 0) params.set("offset", String(filters.offset));
  return params;
}

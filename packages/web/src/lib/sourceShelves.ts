/**
 * Sorts sources onto the shelves Settings › Sources shows them under, from the group
 * `/catalog/sources` reports. Upstream's `-alt` groups, such as `supplement-alt`, hold the
 * smaller and partner releases of the same kind, so each shares its plain group's shelf.
 */
import type { CatalogSource } from "@dnd/catalog";

const SHELVES = [
  "Core rulebooks",
  "Supplements",
  "Settings",
  "Adventures",
  "Screens",
  "Playtest",
  "Other",
] as const;

type Shelf = (typeof SHELVES)[number];

const SHELF_OF_GROUP: Record<string, Shelf> = {
  core: "Core rulebooks",
  supplement: "Supplements",
  "supplement-alt": "Supplements",
  setting: "Settings",
  "setting-alt": "Settings",
  adventure: "Adventures",
  screen: "Screens",
};

/** Upstream's prefix for Unearthed Arcana, which no book or adventure index lists. */
const PLAYTEST = /^X?UA/;

type ShelvedSource = { source: string; title: string | undefined };

export type SourceShelf = { label: Shelf; sources: ShelvedSource[] };

function shelfOf(source: string, row: CatalogSource | undefined): Shelf {
  if (PLAYTEST.test(source)) return "Playtest";
  return (row?.group && SHELF_OF_GROUP[row.group]) || "Other";
}

/** Matches the abbreviation or the title, ignoring case; a blank query matches everything. */
function matches({ source, title }: ShelvedSource, query: string): boolean {
  const q = query.trim().toLowerCase();
  return source.toLowerCase().includes(q) || (title?.toLowerCase().includes(q) ?? false);
}

/** The sources `query` matches, each under its shelf in `SHELVES` order, empty shelves left out. */
export function shelveSources(
  sources: readonly string[],
  catalog: ReadonlyMap<string, CatalogSource> | undefined,
  query: string,
): SourceShelf[] {
  const shelves = new Map<Shelf, ShelvedSource[]>(SHELVES.map((label) => [label, []]));
  for (const source of sources) {
    const row = catalog?.get(source);
    const shelved = { source, title: row?.name };
    if (matches(shelved, query)) shelves.get(shelfOf(source, row))?.push(shelved);
  }
  return [...shelves]
    .filter(([, shelved]) => shelved.length > 0)
    .map(([label, shelved]) => ({ label, sources: shelved }));
}

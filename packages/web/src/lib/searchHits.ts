/** How the web names and addresses a `/search` hit. */
import type { SearchHit } from "@dnd/catalog";

/** Each hit type with a detail, mapped to the collection `catalogRows.ts` reads it from. */
export const HIT_COLLECTIONS = new Map([
  ["background", "backgrounds"],
  ["class", "classes"],
  ["feat", "feats"],
  ["item", "items"],
  ["race", "races"],
  ["spell", "spells"],
]);

/**
 * The detail address a hit opens, or `undefined` for a type the web shows no detail for,
 * such as an optional feature or a Tier C monster.
 */
export function searchHitAddress(hit: SearchHit): string | undefined {
  const collection = HIT_COLLECTIONS.get(hit.type);
  if (!collection) return undefined;
  return "id" in hit
    ? `/homebrew/${collection}/${encodeURIComponent(hit.id)}`
    : `/${collection}/${encodeURIComponent(hit.name)}/${encodeURIComponent(hit.source)}`;
}

/** A hit's identity: its type and key, or its homebrew id. */
export function searchHitKey(hit: SearchHit): string {
  return "id" in hit ? `homebrew:${hit.type}:${hit.id}` : `${hit.type}|${hit.name}|${hit.source}`;
}

const TYPE_LABELS: Record<string, string> = { optfeature: "Optional feature" };

/** A hit's `type` as a reader names it: `legendaryGroup` reads "Legendary group". */
export function searchHitTypeLabel(type: string): string {
  const words = TYPE_LABELS[type] ?? type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A hit's `type` in the plural, as a list of kinds names it: `class` reads "Classes". */
export function searchHitTypePlural(type: string): string {
  const label = searchHitTypeLabel(type);
  if (/(s|x|ch|sh)$/.test(label)) return `${label}es`;
  if (/[^aeiou]y$/.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

/** How the web names and addresses a `/search` hit. */
import type { SearchHit } from "@dnd/catalog";

/**
 * Each hit type with an API route of its own, mapped to the collection `catalogRows.ts`
 * reads it from.
 */
export const HIT_COLLECTIONS = new Map([
  ["background", "backgrounds"],
  ["class", "classes"],
  ["feat", "feats"],
  ["item", "items"],
  ["race", "races"],
  ["spell", "spells"],
]);

const segments = (...parts: string[]) => parts.map(encodeURIComponent).join("/");

/**
 * The detail address a hit opens. A type with no route of its own, such as an optional
 * feature or a monster, opens through `/catalog`, its qualifier a last segment where it
 * carries one.
 */
export function searchHitAddress(hit: SearchHit): string {
  const collection = HIT_COLLECTIONS.get(hit.type);
  if ("id" in hit) return `/homebrew/${collection}/${encodeURIComponent(hit.id)}`;
  if (collection) return `/${collection}/${segments(hit.name, hit.source)}`;
  if (hit.parent) {
    const { parent } = hit;
    return `/classes/${segments(parent.name, parent.source, "subclasses", hit.name, hit.source)}`;
  }
  const key = hit.qualifier ? [hit.name, hit.source, hit.qualifier] : [hit.name, hit.source];
  return `/catalog/${segments(hit.type, ...key)}`;
}

/** A hit's identity: its type and key, or its homebrew id. */
export function searchHitKey(hit: SearchHit): string {
  return "id" in hit
    ? `homebrew:${hit.type}:${hit.id}`
    : JSON.stringify([hit.type, hit.name, hit.source, hit.qualifier, hit.parent]);
}

const TYPE_LABELS: Record<string, string> = {
  optfeature: "Optional feature",
  variantrule: "Variant rule",
};

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

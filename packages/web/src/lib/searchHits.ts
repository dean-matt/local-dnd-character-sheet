/** How the web names and addresses a `/search` hit. */
import type { SearchHit } from "@dnd/catalog";
import { CATALOG_INDEXES, catalogRowPath } from "./catalogIndexes.ts";

/**
 * The detail route a hit opens, or `undefined` for a type the web has no detail route for,
 * such as an optional feature or a Tier C monster.
 */
export function searchHitPath(hit: SearchHit): string | undefined {
  const index = CATALOG_INDEXES.find((candidate) => candidate.type === hit.type);
  return index && catalogRowPath(index.collection, hit);
}

const TYPE_LABELS: Record<string, string> = { optfeature: "Optional feature" };

/** A hit's `type` as a reader names it: `legendaryGroup` reads "Legendary group". */
export function searchHitTypeLabel(type: string): string {
  const words = TYPE_LABELS[type] ?? type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

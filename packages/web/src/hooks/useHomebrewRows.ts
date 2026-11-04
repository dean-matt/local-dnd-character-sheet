import { LISTING_KINDS } from "../lib/homebrewListing.ts";
import { type HomebrewCollection, useHomebrew } from "./useHomebrew.ts";

/**
 * A collection's rows parsed as the Homebrew page parses them. A query key caches one parse,
 * so a reader of a kind whose page schema transforms its rows reads them through this.
 */
export function useHomebrewRows(collection: HomebrewCollection) {
  return useHomebrew(collection, LISTING_KINDS[collection].recordSchema).list;
}

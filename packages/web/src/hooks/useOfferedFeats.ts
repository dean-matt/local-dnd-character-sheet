import {
  type FeatRecord,
  HOMEBREW_SOURCE,
  type HomebrewFeatRecord,
  homebrewFeatRecordSchema,
} from "@dnd/catalog";
import { type CharacterDefinition, type EntryRef, entryKey } from "@dnd/character";
import type { OfferedFeat } from "../lib/improvementFeats.ts";
import { searchHitKey } from "../lib/searchHitKey.ts";
import { useDisabledSources } from "./useDisabledSources.ts";
import { useFeats } from "./useFeats.ts";
import { useHomebrew } from "./useHomebrew.ts";

/**
 * The catalog feats of `edition` and the homebrew feats of that edition, the homebrew ones
 * only while `homebrewShown` or where `held` names them, so a feat the character took stays
 * offered with the Homebrew source off. `undefined` until both lists load.
 */
export function offeredFeats(
  catalog: readonly FeatRecord[] | undefined,
  homebrew: readonly HomebrewFeatRecord[] | undefined,
  edition: CharacterDefinition["edition"],
  homebrewShown: boolean,
  held: readonly EntryRef[],
): OfferedFeat[] | undefined {
  if (catalog === undefined || homebrew === undefined) return undefined;
  const kept = new Set(held.map(entryKey));
  const own = homebrew.filter(
    (feat) => feat.edition === edition && (homebrewShown || kept.has(searchHitKey(feat))),
  );
  return [...catalog, ...own];
}

/**
 * Every feat an improvement or a background may offer in `edition`: `/feats`, which stays
 * catalog-only so its 200-row page always holds them, beside `/homebrew/feats`, which is
 * unbounded. See `offeredFeats` for `held`.
 */
export function useOfferedFeats(
  edition: CharacterDefinition["edition"],
  held: readonly EntryRef[],
): OfferedFeat[] | undefined {
  const catalog = useFeats(edition).data?.items;
  const homebrew = useHomebrew("feats", homebrewFeatRecordSchema).list.data;
  const homebrewShown = !useDisabledSources().includes(HOMEBREW_SOURCE);
  return offeredFeats(catalog, homebrew, edition, homebrewShown, held);
}

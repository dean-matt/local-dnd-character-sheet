import type { CharacterDefinition } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { useOfferedFeats } from "../../hooks/useOfferedFeats.ts";
import {
  type BackgroundFeatOffers,
  backgroundFeatOffers,
  heldFromBackground,
  withBackgroundFeat,
} from "./backgroundFeats.ts";
import { useIdentityCatalog } from "./useIdentityCatalog.ts";

/**
 * What the draft's background offers as a feat, once the rows that answer it have loaded
 * (`offers` is absent until then, so a half-read list never drops a held feat), and the
 * `feats` the draft should hold: `feats` itself where it already does.
 */
export function useBackgroundFeats() {
  const [edition = "one", background, feats = []] = useWatch<
    CharacterDefinition,
    ["edition", "background", "feats"]
  >({ name: ["edition", "background", "feats"] });
  const { backgrounds, backgroundRow } = useIdentityCatalog();
  const offered = useOfferedFeats(
    edition,
    heldFromBackground(feats).map(({ ref }) => ref),
  );
  const offers: BackgroundFeatOffers | undefined =
    backgrounds.isSuccess && offered
      ? backgroundRow
        ? backgroundFeatOffers(backgroundRow.json, offered)
        : { options: [], fixed: false }
      : undefined;
  return {
    background,
    offers,
    feats,
    next: offers ? withBackgroundFeat(feats, background, offers) : feats,
  };
}

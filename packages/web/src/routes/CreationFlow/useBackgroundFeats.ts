import type { CharacterDefinition } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { useFeats } from "../../hooks/useFeats.ts";
import {
  type BackgroundFeatOffers,
  backgroundFeatOffers,
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
  const catalog = useFeats(edition);
  const offers: BackgroundFeatOffers | undefined =
    backgrounds.isSuccess && catalog.isSuccess
      ? backgroundRow
        ? backgroundFeatOffers(backgroundRow.json, catalog.data.items)
        : { options: [], fixed: false }
      : undefined;
  return {
    background,
    offers,
    feats,
    next: offers ? withBackgroundFeat(feats, background, offers) : feats,
  };
}

import { homebrewFeatureEffectRecordSchema, type Mechanic, refKey } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";

export const HOMEBREW_EFFECTS_PATH = "/homebrew/feature-effects";

export const homebrewEffectsQuery = {
  queryKey: ["homebrew", "feature-effects"],
  queryFn: () => apiGet(HOMEBREW_EFFECTS_PATH, z.array(homebrewFeatureEffectRecordSchema)),
};

/** The mechanics each homebrew effect rules, keyed by `refKey` of the catalog feature it rules for. */
export function useHomebrewEffects(): ReadonlyMap<string, readonly Mechanic[]> {
  const { data } = useQuery(homebrewEffectsQuery);
  return useMemo(
    () => new Map((data ?? []).map((effect) => [refKey(effect), effect.mechanics])),
    [data],
  );
}

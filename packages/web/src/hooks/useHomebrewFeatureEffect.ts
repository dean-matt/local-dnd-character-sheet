import {
  type ContentRef,
  type HomebrewFeatureEffectInput,
  homebrewFeatureEffectRecordSchema,
} from "@dnd/character";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiMutate } from "../lib/api.ts";
import { charactersKey } from "./characterKeys.ts";
import { homebrewEffectsQuery, HOMEBREW_EFFECTS_PATH as PATH } from "./useHomebrewEffects.ts";

/**
 * The homebrew effect a table rules for the catalog feature `ref`, if one does, with the writes
 * that set and clear it. The effects list and every character refresh after a write, since any
 * of them may hold the feature.
 */
export function useHomebrewFeatureEffect(ref: ContentRef) {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: homebrewEffectsQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: charactersKey }),
    ]);
  const list = useQuery(homebrewEffectsQuery);
  const effect = list.data?.find(({ name, source }) => name === ref.name && source === ref.source);
  const save = useMutation({
    mutationFn: (input: HomebrewFeatureEffectInput) =>
      effect
        ? apiMutate(
            "PUT",
            `${PATH}/${encodeURIComponent(effect.id)}`,
            homebrewFeatureEffectRecordSchema,
            input,
          )
        : apiMutate("POST", PATH, homebrewFeatureEffectRecordSchema, input),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`${PATH}/${encodeURIComponent(id)}`),
    onSuccess: refresh,
  });
  return { effect, loading: list.isPending, save, remove };
}

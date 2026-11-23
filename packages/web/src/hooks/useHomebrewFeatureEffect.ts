import {
  type ContentRef,
  type HomebrewFeatureEffectInput,
  homebrewFeatureEffectRecordSchema,
} from "@dnd/character";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiDelete, apiGet, apiMutate } from "../lib/api.ts";

const PATH = "/homebrew/feature-effects";

/**
 * The homebrew effect a table rules for the catalog feature `ref`, if one does, with the writes
 * that set and clear it. The effects list refreshes after a write.
 */
export function useHomebrewFeatureEffect(ref: ContentRef) {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["homebrew", "feature-effects"] });
  const list = useQuery({
    queryKey: ["homebrew", "feature-effects"],
    queryFn: () => apiGet(PATH, z.array(homebrewFeatureEffectRecordSchema)),
  });
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

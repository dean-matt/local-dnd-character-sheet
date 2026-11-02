import { homebrewClassFeaturesSchema, type homebrewCollectionSchema } from "@dnd/catalog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiDelete, apiGet, apiMutate } from "../lib/api.ts";
import { isRecord } from "../lib/entryGuards.ts";

/**
 * The path segment of each kind's routes, `/homebrew/{collection}`, of the kinds the app
 * edits: there is no subrace, deity, optional feature or monster editor yet.
 */
export type HomebrewCollection = Exclude<
  z.infer<typeof homebrewCollectionSchema>,
  "subraces" | "deities" | "optional-features" | "monsters" | "class-resources"
>;

/**
 * One homebrew collection under `/homebrew/{collection}`: its rows, a save that creates a
 * row where `id` is absent and replaces it otherwise, and a delete by id. `listed: false`
 * leaves the rows unfetched, for a caller that only saves.
 */
export function useHomebrew<R>(
  collection: HomebrewCollection,
  schema: z.ZodType<R>,
  { listed = true }: { listed?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const path = `/homebrew/${collection}`;
  const rowPath = (id: string) => `${path}/${encodeURIComponent(id)}`;
  // Every query, not the list's alone: search results, catalog rows and any sheet holding
  // the row read it too, and nothing names those keys by homebrew id.
  const refresh = () => queryClient.invalidateQueries();

  const list = useQuery({
    queryKey: ["homebrew", collection],
    queryFn: () => apiGet(path, z.array(schema)),
    enabled: listed,
  });
  const save = useMutation({
    mutationFn: async ({ id, input }: { id: string | undefined; input: unknown }) => {
      const write = (body: unknown) =>
        id === undefined
          ? apiMutate("POST", path, schema, body)
          : apiMutate("PUT", rowPath(id), schema, body);
      if (collection !== "classes" || !isRecord(input)) return write(input);
      // A class's features live beside its row, so the save is two writes. A new class whose
      // features fail is deleted again, so a second try does not conflict with the first.
      const { features = [], ...row } = input;
      const saved = await write(row);
      const savedId = id ?? z.object({ id: z.string() }).parse(saved).id;
      try {
        await apiMutate(
          "PUT",
          `${rowPath(savedId)}/features`,
          homebrewClassFeaturesSchema,
          features,
        );
      } catch (error) {
        if (id === undefined) await apiDelete(rowPath(savedId)).catch(() => undefined);
        throw error;
      }
      return saved;
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(rowPath(id)),
    onSuccess: refresh,
  });
  return { list, save, remove };
}

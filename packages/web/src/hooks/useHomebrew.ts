import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiDelete, apiGet, apiMutate } from "../lib/api.ts";

/**
 * One homebrew collection under `/homebrew/{collection}`: its rows, a save that creates a
 * row where `id` is absent and replaces it otherwise, and a delete by id.
 */
export function useHomebrew<R>(collection: "items" | "spells", schema: z.ZodType<R>) {
  const queryClient = useQueryClient();
  const path = `/homebrew/${collection}`;
  const rowPath = (id: string) => `${path}/${encodeURIComponent(id)}`;
  // Every query, not the list's alone: search results, catalog rows and any sheet holding
  // the row read it too, and nothing names those keys by homebrew id.
  const refresh = () => queryClient.invalidateQueries();

  const list = useQuery({
    queryKey: ["homebrew", collection],
    queryFn: () => apiGet(path, z.array(schema)),
  });
  const save = useMutation({
    mutationFn: ({ id, input }: { id: string | undefined; input: unknown }) =>
      id === undefined
        ? apiMutate("POST", path, schema, input)
        : apiMutate("PUT", rowPath(id), schema, input),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(rowPath(id)),
    onSuccess: refresh,
  });
  return { list, save, remove };
}

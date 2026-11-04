import { homebrewImportResultSchema } from "@dnd/catalog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMutate } from "../lib/api.ts";
import { readJsonFile } from "../lib/readJsonFile.ts";

/**
 * Sends a homebrew file to the API, which creates every entry in it or none. A file that is
 * not JSON fails here, before any request.
 */
export function useImportHomebrew() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) =>
      apiMutate("POST", "/homebrew/import", homebrewImportResultSchema, await readJsonFile(file)),
    // Every query, as a homebrew save refreshes: search, catalog lists and sheets read the rows too.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

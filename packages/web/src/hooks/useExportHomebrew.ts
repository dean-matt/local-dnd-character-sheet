import { type HomebrewExportRequest, type HomebrewFile, homebrewFileSchema } from "@dnd/catalog";
import { useMutation } from "@tanstack/react-query";
import { apiMutate } from "../lib/api.ts";
import { downloadJson } from "../lib/downloadJson.ts";

/** Fetches the chosen rows' file and hands it to the browser as `homebrew.json`. */
export function useExportHomebrew() {
  return useMutation<HomebrewFile, Error, HomebrewExportRequest["entries"]>({
    mutationFn: async (entries) => {
      const file = await apiMutate("POST", "/homebrew/export", homebrewFileSchema, { entries });
      downloadJson(file, "homebrew.json");
      return file;
    },
  });
}

import { type CharacterRecord, characterFileSchema } from "@dnd/character";
import { useMutation } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { downloadJson } from "../lib/downloadJson.ts";

/** Fetches the character's file and hands it to the browser as a download named for it. */
export function useExportCharacter(character: Pick<CharacterRecord, "id" | "name">) {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const file = await apiGet(`/characters/${character.id}/export`, characterFileSchema);
      downloadJson(file, `${character.name.trim() || "character"}.json`);
    },
  });
}

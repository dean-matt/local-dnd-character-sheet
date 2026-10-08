import { type CharacterRecord, characterFileSchema } from "@dnd/character";
import { useMutation } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";

/** Fetches the character's file and hands it to the browser as a download named for it. */
export function useExportCharacter(character: Pick<CharacterRecord, "id" | "name">) {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const file = await apiGet(`/characters/${character.id}/export`, characterFileSchema);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${character.name.trim() || "character"}.json`;
      link.click();
      // A revoke in the same task can cancel the download in some browsers before it starts.
      setTimeout(() => URL.revokeObjectURL(url));
    },
  });
}

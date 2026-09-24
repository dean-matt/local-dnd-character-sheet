import { characterPageRecordSchema } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";
import { characterKey } from "./useCharacters.ts";

/** A character's pages in display order, hidden ones included, so a URL still reaches one. */
export function useCharacterPages(id: string) {
  return useQuery({
    queryKey: [...characterKey(id), "pages"],
    queryFn: () => apiGet(`/characters/${id}/pages`, z.array(characterPageRecordSchema)),
    enabled: id.length > 0,
  });
}

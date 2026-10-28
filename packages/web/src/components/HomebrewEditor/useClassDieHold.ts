import { homebrewClassInputSchema, homebrewClassRecordSchema } from "@dnd/catalog";
import { useQuery } from "@tanstack/react-query";
import { charactersQuery } from "../../hooks/useCharacters.ts";
import type { HomebrewCollection } from "../../hooks/useHomebrew.ts";
import type { HomebrewRow } from "../../lib/homebrewListing.ts";
import type { HomebrewDraft } from "./homebrewDraft.ts";

/** A stored class whose die the draft would change under the characters holding it. */
export interface ClassDieHold {
  name: string;
  hitDie: number;
  characters: { id: string; name: string }[];
}

/**
 * The hold on saving a stored homebrew class whose draft changes its hit die while characters
 * hold it; `undefined` for any other kind, a new class, a draft that keeps the die or does not
 * parse, and while the holders load or fail to, where the server's refusal still stands.
 * Only `levels[].class` is read; the server walks the whole definition and refuses any holder
 * this misses.
 */
export function useClassDieHold(
  collection: HomebrewCollection,
  record: HomebrewRow | undefined,
  checked: HomebrewDraft<unknown>,
): ClassDieHold | undefined {
  const stored =
    collection === "classes" ? homebrewClassRecordSchema.safeParse(record).data : undefined;
  const holders = useQuery({
    ...charactersQuery,
    enabled: stored !== undefined,
    select: (characters) =>
      characters
        .filter(({ definition }) =>
          definition.levels.some(
            ({ class: ref }) => "homebrewId" in ref && ref.homebrewId === stored?.id,
          ),
        )
        .map(({ id, name }) => ({ id, name })),
  });
  const faces = homebrewClassInputSchema.safeParse("input" in checked ? checked.input : undefined)
    .data?.hd.faces;
  if (!stored || faces === undefined || faces === stored.hitDie || !holders.data?.length) {
    return undefined;
  }
  return { name: stored.name, hitDie: stored.hitDie, characters: holders.data };
}

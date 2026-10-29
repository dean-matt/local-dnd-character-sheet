import { homebrewClassInputSchema, homebrewClassRecordSchema } from "@dnd/catalog";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { charactersQuery } from "../../hooks/useCharacters.ts";
import type { HomebrewCollection } from "../../hooks/useHomebrew.ts";
import type { HomebrewRow } from "../../lib/homebrewListing.ts";
import { refusedHolders } from "../../lib/refusedHolders.ts";
import type { HomebrewDraft } from "./homebrewDraft.ts";

/** A stored class whose die the draft would change under the characters holding it. */
export interface ClassDieHold {
  name: string;
  hitDie: number;
  /** `undefined` where the holders failed to load. */
  characters: { id: string; name: string }[] | undefined;
  /** Reads the holders again. */
  retry: () => void;
  /** Whether a read of the holders is in flight. */
  checking: boolean;
}

/**
 * The hold on saving a stored homebrew class whose draft changes its hit die while characters
 * hold it, or could not be checked; `undefined` for any other kind, a new class, a draft that
 * keeps the die or does not parse, while the holders first load, and where none holds the class.
 * Only `levels[].class` is read; the server walks the whole definition and refuses any holder
 * this misses, so the holders a refused save names stand in for a list that missed them.
 */
export function useClassDieHold(
  collection: HomebrewCollection,
  record: HomebrewRow | undefined,
  checked: HomebrewDraft<unknown>,
  failure: Error | null,
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
  const changing = stored !== undefined && faces !== undefined && faces !== stored.hitDie;
  const { refetch } = holders;
  // A focus refetch misses a character added in a window that never hid this one.
  useEffect(() => {
    if (changing) void refetch();
  }, [changing, refetch]);
  if (!changing) return undefined;
  const refused = refusedHolders(failure).characters;
  const listed = holders.data?.length ? holders.data : undefined;
  const characters = listed ?? (refused.length ? refused : undefined);
  if (!characters && !holders.isError) return undefined;
  return {
    name: stored.name,
    hitDie: stored.hitDie,
    characters,
    retry: () => void refetch(),
    checking: holders.isFetching,
  };
}

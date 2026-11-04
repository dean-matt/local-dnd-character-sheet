import {
  homebrewClassInputSchema,
  homebrewClassRecordSchema,
  homebrewSubclassInputSchema,
  sameSubclassParent,
  subclassParentLabel,
} from "@dnd/catalog";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";
import { charactersQuery } from "../../hooks/useCharacters.ts";
import type { HomebrewCollection } from "../../hooks/useHomebrew.ts";
import type { HomebrewRow } from "../../lib/homebrewListing.ts";
import { refusedHolders } from "../../lib/refusedHolders.ts";
import type { HomebrewDraft } from "./homebrewDraft.ts";

/** What a draft would change under the characters holding a stored row, in a hold's words. */
interface HeldChange {
  /** Follows "{name} is held by these characters, ". */
  consequence: string;
  /** Follows "A held {noun} keeps ". */
  kept: string;
}

/** A stored row a character can hold, and the change of a draft that holders refuse. */
interface HeldRow {
  id: string;
  name: string;
  noun: string;
  /** `undefined` where `input` does not parse or keeps what holders rely on. */
  changeOf: (input: unknown) => HeldChange | undefined;
}

const parentOfSchema = z.object({ parent: homebrewSubclassInputSchema.shape.parent });

/** A stored subclass as the listing hands it to the editor, its parent moved into `json`. */
const storedSubclassSchema = z.object({
  id: z.string(),
  name: z.string(),
  className: z.string(),
  classSource: z.string(),
  classId: z.string().optional(),
  json: parentOfSchema,
});

function heldRowOf(
  collection: HomebrewCollection,
  record: HomebrewRow | undefined,
): HeldRow | undefined {
  if (collection === "classes") {
    const stored = homebrewClassRecordSchema.safeParse(record).data;
    if (!stored) return undefined;
    const die = `d${stored.hitDie}`;
    return {
      id: stored.id,
      name: stored.name,
      noun: "class",
      changeOf: (input) => {
        const faces = homebrewClassInputSchema.safeParse(input).data?.hd.faces;
        if (faces === undefined || faces === stored.hitDie) return undefined;
        return {
          consequence: `so its hit die stays ${die}. Keep ${die}, or add a class with another name for the new die.`,
          kept: `its hit die, ${die}`,
        };
      },
    };
  }
  if (collection === "subclasses") {
    const stored = storedSubclassSchema.safeParse(record).data;
    if (!stored) return undefined;
    const parent = subclassParentLabel(stored);
    return {
      id: stored.id,
      name: stored.name,
      noun: "subclass",
      changeOf: (input) => {
        const next = parentOfSchema.safeParse(input).data?.parent;
        if (next === undefined || sameSubclassParent(next, stored.json.parent)) return undefined;
        return {
          consequence: `so it stays a subclass of ${parent}. Keep ${parent}, or add a new subclass to the other class.`,
          kept: `its parent class, ${parent}`,
        };
      },
    };
  }
  return undefined;
}

/** A stored row whose draft changes what the characters holding it rely on. */
export interface HeldSaveHold extends HeldChange {
  name: string;
  noun: string;
  /** `undefined` where the holders failed to load. */
  characters: { id: string; name: string }[] | undefined;
  /** Reads the holders again; resolves `true` where the read succeeded. */
  retry: () => Promise<boolean>;
  checking: boolean;
}

/**
 * The hold on saving a stored homebrew row whose draft changes what its holders rely on (a
 * class's hit die, a subclass's parent class) while characters hold it, or could not be
 * checked; `undefined` for any other kind, a new row, a draft that keeps it or does not parse,
 * while the holders first load, and where none holds the row.
 * A change reads the holders again and leaves Save to the last list until that read lands,
 * which on a local API takes milliseconds; the server's refusal covers a save inside that gap.
 * Only `levels[]` is read; the server walks the whole definition and refuses any holder this
 * misses, so the holders a refused save names stand in for a list that missed them.
 */
export function useHeldSaveHold(
  collection: HomebrewCollection,
  record: HomebrewRow | undefined,
  checked: HomebrewDraft<unknown>,
  failure: Error | null,
): HeldSaveHold | undefined {
  const stored = heldRowOf(collection, record);
  const holders = useQuery({
    ...charactersQuery,
    enabled: stored !== undefined,
    select: (characters) =>
      characters
        .filter(({ definition }) =>
          definition.levels.some((level) =>
            [level.class, level.subclass].some(
              (ref) => ref !== undefined && "homebrewId" in ref && ref.homebrewId === stored?.id,
            ),
          ),
        )
        .map(({ id, name }) => ({ id, name })),
  });
  const change = stored?.changeOf("input" in checked ? checked.input : undefined);
  const changing = change !== undefined;
  const { refetch } = holders;
  // A focus refetch misses a character added in a window that never hid this one.
  useEffect(() => {
    if (changing) void refetch();
  }, [changing, refetch]);
  if (!stored || !change) return undefined;
  const refused = refusedHolders(failure).characters;
  const listed = holders.data?.length ? holders.data : undefined;
  const characters = listed ?? (refused.length ? refused : undefined);
  // A retry with no list yet puts the query back to pending, which must not read as a first load.
  const unchecked = holders.isError || (holders.isPending && holders.errorUpdateCount > 0);
  if (!characters && !unchecked) return undefined;
  return {
    ...change,
    name: stored.name,
    noun: stored.noun,
    characters,
    retry: () => refetch().then(({ isSuccess }) => isSuccess),
    checking: holders.isFetching,
  };
}

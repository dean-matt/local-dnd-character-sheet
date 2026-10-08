import { catalogRowRecordSchema } from "@dnd/catalog";
import type { CharacterDefinition, ContentRef, EntryRef } from "@dnd/character";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useWatch } from "react-hook-form";
import { z } from "zod";
import { apiGet } from "../../lib/api.ts";
import { retryUnlessClientError } from "../../lib/retryUnlessClientError.ts";
import { useClassEntries } from "./useClassEntries.ts";
import { useIdentityCatalog } from "./useIdentityCatalog.ts";

export interface EditionMismatch {
  /** What was chosen, such as `Race`. */
  label: string;
  value: string;
}

const named = (ref: ContentRef) => `${ref.name} (${ref.source})`;

const nameAndEdition = z.object({
  name: z.string(),
  edition: catalogRowRecordSchema.shape.edition,
});

/**
 * The name and edition of the row at `path`, `undefined` until it loads. A row both
 * editions share carries a `null` edition.
 */
function useRowAt(path: string | undefined) {
  return useQuery({
    queryKey: ["edition", path],
    queryFn: path ? () => apiGet(path, nameAndEdition) : skipToken,
    retry: retryUnlessClientError,
  }).data;
}

const homebrewPath = (kind: string, ref: EntryRef | undefined) =>
  ref && "homebrewId" in ref
    ? `/homebrew/${kind}/${encodeURIComponent(ref.homebrewId)}`
    : undefined;

const inList = (rows: readonly ContentRef[], ref: ContentRef) =>
  rows.some((row) => row.name === ref.name && row.source === ref.source);

/** `ref` as a mismatch where the edition's loaded `rows` lack it. */
const missingFrom = (
  label: string,
  ref: ContentRef | undefined,
  rows: readonly ContentRef[] | undefined,
): EditionMismatch | undefined =>
  ref && rows && !inList(rows, ref) ? { label, value: named(ref) } : undefined;

type Edition = CharacterDefinition["edition"];

/** `value` as a mismatch where its row carries an edition other than `edition`. */
const otherThan =
  (edition: Edition) =>
  (label: string, value: string | undefined, rowEdition: Edition | null | undefined) =>
    value !== undefined && rowEdition != null && rowEdition !== edition
      ? { label, value }
      : undefined;

const homebrewName = (row: { name: string } | undefined) => row && `${row.name} (homebrew)`;

/**
 * Each choice made so far that the character's edition does not hold: a race, class or
 * deity row, or a homebrew race, background or class, of the other edition; or a subrace,
 * background or subclass absent from the edition's list, for every class the draft holds. A choice counts only once its row
 * loads, so one still loading is never named, and a deity both editions share never is.
 */
export function useEditionMismatches(): EditionMismatch[] {
  const [race, subrace, background, deity] = useWatch<
    CharacterDefinition,
    ["race", "subrace", "background", "deity"]
  >({ name: ["race", "subrace", "background", "deity"] });
  const { edition, catalogRace, raceRow, subraces, backgrounds } = useIdentityCatalog();
  const { entries } = useClassEntries();
  const homebrewRace = useRowAt(homebrewPath("races", race));
  const homebrewBackground = useRowAt(homebrewPath("backgrounds", background));
  const deityRow = useRowAt(
    deity &&
      `/catalog/deity/${encodeURIComponent(deity.name)}/${encodeURIComponent(deity.source)}?qualifier=${encodeURIComponent(deity.pantheon)}`,
  );
  const other = otherThan(edition);
  const catalogBackground = background && "name" in background ? background : undefined;
  return [
    other("Race", catalogRace && named(catalogRace), raceRow.data?.edition),
    other("Race", homebrewName(homebrewRace), homebrewRace?.edition),
    missingFrom("Subrace", subrace, subraces.data?.items),
    missingFrom("Background", catalogBackground, backgrounds.data?.items),
    other("Background", homebrewName(homebrewBackground), homebrewBackground?.edition),
    ...entries.flatMap((entry) => [
      other(
        "Class",
        entry.catalogClass ? named(entry.catalogClass) : homebrewName(entry),
        entry.rowEdition,
      ),
      missingFrom("Subclass", entry.subclass, entry.subclasses),
    ]),
    other("Deity", deity && `${deity.name} · ${deity.pantheon}`, deityRow?.edition),
  ].filter((mismatch) => mismatch !== undefined);
}

import { type SubclassRecord, subclassLevelSchema } from "@dnd/catalog";
import {
  type CharacterDefinition,
  type ContentRef,
  classLevels,
  type EntryRef,
  entryKey,
} from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { classGrantsQuery } from "../../../../hooks/classGrantsQuery.ts";
import { classQuery } from "../../../../hooks/classQuery.ts";
import { homebrewClassQuery } from "../../../../hooks/homebrewClassQuery.ts";
import { subclassesQuery } from "../../../../hooks/subclassesQuery.ts";
import { subclassGrantsQuery } from "../../../../hooks/subclassGrantsQuery.ts";

const sameRef = (row: ContentRef, ref: ContentRef | undefined) =>
  ref !== undefined && row.name === ref.name && row.source === ref.source;

/**
 * The subclass level, where level `next` asks for a subclass: the class holds none, offers
 * some, and reaches its subclass level at `next` or reached it earlier without one.
 */
function subclassFrom(
  held: ContentRef | undefined,
  subclassLevel: number | undefined,
  next: number,
  offered: boolean,
): number | undefined {
  if (held !== undefined || subclassLevel === undefined || !offered) return undefined;
  return next >= subclassLevel ? subclassLevel : undefined;
}

/**
 * What one more level in `cls` reads: the class's hit die, whether this level asks for a
 * subclass, at the class's subclass level or past it for a class that reached it without one,
 * and which ones it offers, and the class's and subclass's grants at its level now
 * and at the next. `picked` is the subclass chosen this level, read where the class holds
 * none yet. A homebrew class carries a hit die and nothing else.
 */
export function useLevelUpClass(
  definition: CharacterDefinition,
  cls: EntryRef,
  picked: ContentRef | undefined,
) {
  const held = classLevels(definition).find((group) => entryKey(group.class) === entryKey(cls));
  const level = held?.level ?? 0;
  const next = level + 1;
  const catalog = "name" in cls ? cls : undefined;
  const row = useQuery(classQuery(catalog));
  const homebrew = useQuery(homebrewClassQuery("homebrewId" in cls ? cls.homebrewId : undefined));
  const subclassList = useQuery(subclassesQuery(catalog, definition.edition));
  const subclassLevel = row.data && subclassLevelSchema.parse(row.data.json);
  const subclasses: readonly SubclassRecord[] = subclassList.data?.items ?? [];
  const from = subclassFrom(held?.subclass, subclassLevel, next, subclasses.length > 0);
  const asksSubclass = from !== undefined;
  const subclass = held?.subclass ?? (asksSubclass ? picked : undefined);
  const before = useQuery(classGrantsQuery(level > 0 ? catalog : undefined, level));
  const after = useQuery(classGrantsQuery(catalog, next));
  const subclassBefore = useQuery(subclassGrantsQuery(catalog, held?.subclass, level));
  const subclassAfter = useQuery(subclassGrantsQuery(catalog, subclass, next));
  const pending = [row, after, subclassList, subclassAfter, before, subclassBefore].some(
    (query) => query.isLoading,
  );
  return {
    level,
    next,
    name: catalog?.name ?? homebrew.data?.name ?? "Homebrew",
    /** The catalog class's row, which a homebrew class has none of. */
    json: row.data?.json,
    hitDie: row.data?.hitDie ?? homebrew.data?.hitDie,
    asksSubclass,
    /** The first level whose subclass features this level brings: all of them where it picks the subclass. */
    subclassFrom: from ?? next,
    subclasses,
    subclass,
    subclassRow: subclasses.find((each) => sameRef(each, subclass)),
    before: before.data,
    after: after.data,
    subclassBefore: subclassBefore.data,
    subclassAfter: subclassAfter.data,
    read:
      !pending && (catalog === undefined ? homebrew.isSuccess : row.isSuccess && after.isSuccess),
  };
}

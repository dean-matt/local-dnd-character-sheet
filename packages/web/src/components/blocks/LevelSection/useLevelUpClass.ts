import {
  type CharacterDefinition,
  catalogRef,
  classLevels,
  type EntryRef,
  entryKey,
} from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { classGrantsQuery } from "../../../hooks/classGrantsQuery.ts";
import { classQuery } from "../../../hooks/classQuery.ts";
import { homebrewClassQuery } from "../../../hooks/homebrewClassQuery.ts";
import { subclassesQuery } from "../../../hooks/subclassesQuery.ts";
import { subclassGrantsQuery } from "../../../hooks/subclassGrantsQuery.ts";
import {
  catalogSubclassRow,
  homebrewSubclassRow,
  type SubclassItem,
  subclassLevelOf,
  subclassParent,
} from "../../../lib/subclassItems.ts";

/**
 * The subclass level, where level `next` asks for a subclass: the class holds none, offers
 * some, and reaches its subclass level at `next` or reached it earlier without one.
 */
function subclassFrom(
  held: EntryRef | undefined,
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
 * none yet. A homebrew class carries a hit die, its subclass level and subclasses, and no grants.
 */
export function useLevelUpClass(
  definition: CharacterDefinition,
  cls: EntryRef,
  picked: EntryRef | undefined,
) {
  const held = classLevels(definition).find((group) => entryKey(group.class) === entryKey(cls));
  const level = held?.level ?? 0;
  const next = level + 1;
  const catalog = "name" in cls ? cls : undefined;
  const row = useQuery(classQuery(catalog));
  const homebrew = useQuery(homebrewClassQuery("homebrewId" in cls ? cls.homebrewId : undefined));
  const subclassList = useQuery(
    subclassesQuery(
      subclassParent(cls, homebrew.data),
      homebrew.data?.edition ?? definition.edition,
    ),
  );
  const subclassLevel = subclassLevelOf(row.data?.json, homebrew.data);
  const subclasses: readonly SubclassItem[] = subclassList.data?.items ?? [];
  const from = subclassFrom(held?.subclass, subclassLevel, next, subclasses.length > 0);
  const asksSubclass = from !== undefined;
  const subclass = held?.subclass ?? (asksSubclass ? picked : undefined);
  const before = useQuery(classGrantsQuery(level > 0 ? catalog : undefined, level));
  const after = useQuery(classGrantsQuery(catalog, next));
  const subclassBefore = useQuery(subclassGrantsQuery(catalog, catalogRef(held?.subclass), level));
  const subclassAfter = useQuery(subclassGrantsQuery(catalog, catalogRef(subclass), next));
  const pending = [row, after, subclassList, subclassAfter, before, subclassBefore].some(
    (query) => query.isLoading,
  );
  return {
    level,
    next,
    name: catalog?.name ?? homebrew.data?.name ?? "Homebrew",
    /** The catalog class's row, which a homebrew class has none of. */
    json: row.data?.json,
    edition: row.data?.edition,
    hitDie: row.data?.hitDie ?? homebrew.data?.hitDie,
    asksSubclass,
    /** The first level whose subclass features this level brings: all of them where it picks the subclass. */
    subclassFrom: from ?? next,
    subclasses,
    subclass,
    /** The catalog row of `subclass`, which a homebrew subclass has none of. */
    subclassRow: catalogSubclassRow(subclasses, subclass),
    /** The homebrew class's row, which a catalog class has none of. */
    homebrew: homebrew.data,
    /** The homebrew row of `subclass`, which a catalog subclass has none of. */
    homebrewSubclass: homebrewSubclassRow(subclasses, subclass),
    before: before.data,
    after: after.data,
    subclassBefore: subclassBefore.data,
    subclassAfter: subclassAfter.data,
    read:
      !pending && (catalog === undefined ? homebrew.isSuccess : row.isSuccess && after.isSuccess),
  };
}

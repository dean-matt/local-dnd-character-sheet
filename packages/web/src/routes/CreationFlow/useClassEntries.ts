import {
  type ClassProficiencyGrants,
  classProficiencyGrantsSchema,
  multiclassEntrySchema,
  multiclassPrerequisiteSchema,
  type ScoreMinimums,
  type SubclassRecord,
} from "@dnd/catalog";
import {
  type CharacterDefinition,
  type ContentRef,
  displayName,
  type EntryRef,
  entryKey,
} from "@dnd/character";
import { useQueries } from "@tanstack/react-query";
import { useWatch } from "react-hook-form";
import { classQuery } from "../../hooks/classQuery.ts";
import { homebrewClassQuery } from "../../hooks/homebrewClassQuery.ts";
import { subclassesQuery } from "../../hooks/subclassesQuery.ts";
import { useHomebrewClassIds } from "../../hooks/useHomebrewClassIds.ts";
import { catalogClass } from "../../lib/catalogClass.ts";
import {
  catalogSubclassRow,
  type SubclassItem,
  subclassLevelOf,
  subclassParent,
} from "../../lib/subclassItems.ts";
import { subclassOf } from "./classLevels.ts";

type Level = CharacterDefinition["levels"][number];

/** One class the draft holds, with the rows its choices read. */
export interface ClassEntry {
  cls: EntryRef;
  catalogClass: ContentRef | undefined;
  /** The class's name as a sheet prints it, a homebrew class's once its row loads. */
  name: string;
  level: number;
  /** The position in `levels` of the class's first level. */
  firstIndex: number;
  subclass: EntryRef | undefined;
  /**
   * The subclasses the class offers in the draft's edition, the homebrew's among them,
   * `undefined` until they load.
   */
  subclasses: readonly SubclassItem[] | undefined;
  /** The catalog row of `subclass`, which a homebrew subclass has none of. */
  subclassRow: SubclassRecord | undefined;
  hitDie: number | undefined;
  subclassLevel: number | undefined;
  /** The class's own row, from the catalog or from homebrew, `undefined` until it loads. */
  json: unknown;
  /**
   * The row in the shape the starting grant and choice schemas read: the class's own for
   * the first class, its multiclass gains for every later one.
   */
  start: unknown;
  /** What the class grants outright, a later class's multiclass gains alone. */
  grants: ClassProficiencyGrants | undefined;
  /** The scores the class needs to multiclass in or out of; see `multiclassPrerequisiteSchema`. */
  prerequisite: ScoreMinimums[] | undefined;
  /** The edition the class's row carries, `undefined` until it loads. */
  rowEdition: CharacterDefinition["edition"] | undefined;
  /** The class's own row has loaded; its subclasses may still be loading. */
  read: boolean;
  /** The row the class's grants read is still loading or failed to load. */
  awaited: boolean;
  /** A row the class reads failed to load. */
  failed: boolean;
}

/** `levels` grouped by class, in the order each was first taken. */
function classGroups(levels: readonly Level[]) {
  const groups = new Map<string, { cls: EntryRef; level: number; firstIndex: number }>();
  levels.forEach((level, index) => {
    const key = entryKey(level.class);
    const group = groups.get(key) ?? { cls: level.class, level: 0, firstIndex: index };
    group.level += 1;
    groups.set(key, group);
  });
  return [...groups.values()];
}

/**
 * What the class grants at the draft's start: the first class's own row, a later catalog
 * class's multiclass gains, and nothing for a later homebrew class, which has none.
 */
function startOf(own: unknown, catalog: boolean, index: number) {
  if (!own) return undefined;
  if (index === 0) return own;
  return catalog ? multiclassEntrySchema.parse(own) : undefined;
}

/**
 * Every class the draft holds, in the order each was first taken, with the rows its
 * choices read: the catalog or homebrew class, and its subclasses in the character's edition,
 * or a homebrew class's own. A homebrew class needs no score to multiclass.
 */
export function useClassEntries() {
  const [edition = "one", levels = []] = useWatch<CharacterDefinition, ["edition", "levels"]>({
    name: ["edition", "levels"],
  });
  const groups = classGroups(levels);
  const classRows = useQueries({
    queries: groups.map(({ cls }) => classQuery(catalogClass(cls))),
  });
  const { ids, unmatched } = useHomebrewClassIds(
    groups.map(({ cls }) => cls),
    edition,
  );
  const homebrews = useQueries({ queries: ids.map((id) => homebrewClassQuery(id)) });
  const subclassLists = useQueries({
    queries: groups.map(({ cls }, index) =>
      subclassesQuery(
        subclassParent(cls, homebrews[index]?.data),
        homebrews[index]?.data?.edition ?? edition,
      ),
    ),
  });
  const entries = groups.map((group, index): ClassEntry => {
    const catalog = catalogClass(group.cls);
    const classRow = classRows[index];
    const homebrew = homebrews[index];
    const subclasses = subclassLists[index];
    const json = classRow?.data?.json;
    const own = json ?? homebrew?.data?.json;
    const start = startOf(own, catalog !== undefined, index);
    const subclass = subclassOf(levels, group.cls);
    return {
      ...group,
      catalogClass: catalog,
      json: own,
      name: catalog?.name ?? homebrew?.data?.name ?? displayName(group.cls),
      subclass,
      subclasses: subclasses?.data?.items,
      subclassRow: catalogSubclassRow(subclasses?.data?.items, subclass),
      hitDie: classRow?.data?.hitDie ?? homebrew?.data?.hitDie,
      subclassLevel: subclassLevelOf(json, homebrew?.data),
      start,
      grants: start && classProficiencyGrantsSchema.parse(start),
      prerequisite: catalog ? json && multiclassPrerequisiteSchema.parse(json) : [],
      rowEdition: classRow?.data?.edition ?? homebrew?.data?.edition,
      read: (catalog ? classRow : homebrew)?.isSuccess === true,
      awaited: catalog ? classRow?.isSuccess !== true : homebrew?.isSuccess !== true,
      failed: Boolean(
        classRow?.isError || subclasses?.isError || homebrew?.isError || unmatched[index],
      ),
    };
  });
  return { edition, levels, entries };
}

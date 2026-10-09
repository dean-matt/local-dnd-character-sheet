import {
  type ClassProficiencyGrants,
  classProficiencyGrantsSchema,
  multiclassEntrySchema,
  multiclassPrerequisiteSchema,
  type ScoreMinimums,
  type SubclassRecord,
  subclassLevelSchema,
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
import { subclassOf } from "./classLevels.ts";

type Level = CharacterDefinition["levels"][number];

/** One class the draft holds, with the rows its choices read. */
export interface ClassEntry {
  cls: EntryRef;
  catalogClass: ContentRef | undefined;
  /** The class's name as a sheet prints it, a homebrew class's once its row loads. */
  name: string;
  /** How many levels the draft holds in the class. */
  level: number;
  /** The position in `levels` of the class's first level. */
  firstIndex: number;
  subclass: ContentRef | undefined;
  /** The subclasses the class offers in the draft's edition, `undefined` until they load. */
  subclasses: readonly SubclassRecord[] | undefined;
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

const catalogOf = (cls: EntryRef) => ("name" in cls ? cls : undefined);
const homebrewOf = (cls: EntryRef) => ("homebrewId" in cls ? cls.homebrewId : undefined);

/**
 * Every class the draft holds, in the order each was first taken, with the rows its
 * choices read: the catalog or homebrew class, and a catalog class's subclasses in the
 * character's edition. A homebrew class grants no subclass and needs no score to multiclass.
 */
export function useClassEntries() {
  const [edition = "one", levels = []] = useWatch<CharacterDefinition, ["edition", "levels"]>({
    name: ["edition", "levels"],
  });
  const groups = classGroups(levels);
  const classRows = useQueries({ queries: groups.map(({ cls }) => classQuery(catalogOf(cls))) });
  const subclassLists = useQueries({
    queries: groups.map(({ cls }) => subclassesQuery(catalogOf(cls), edition)),
  });
  const homebrews = useQueries({
    queries: groups.map(({ cls }) => homebrewClassQuery(homebrewOf(cls))),
  });
  const entries = groups.map((group, index): ClassEntry => {
    const catalogClass = catalogOf(group.cls);
    const classRow = classRows[index];
    const homebrew = homebrews[index];
    const subclasses = subclassLists[index];
    const json = classRow?.data?.json;
    const own = json ?? homebrew?.data?.json;
    const start = json && (index === 0 ? json : multiclassEntrySchema.parse(json));
    return {
      ...group,
      catalogClass,
      json: own,
      name: catalogClass?.name ?? homebrew?.data?.name ?? displayName(group.cls),
      subclass: subclassOf(levels, group.cls),
      subclasses: subclasses?.data?.items,
      hitDie: classRow?.data?.hitDie ?? homebrew?.data?.hitDie,
      subclassLevel: json && subclassLevelSchema.parse(json),
      start,
      grants: start && classProficiencyGrantsSchema.parse(start),
      prerequisite: catalogClass ? json && multiclassPrerequisiteSchema.parse(json) : [],
      rowEdition: classRow?.data?.edition ?? homebrew?.data?.edition,
      read: (catalogClass ? classRow : homebrew)?.isSuccess === true,
      failed: Boolean(classRow?.isError || subclasses?.isError || homebrew?.isError),
    };
  });
  return { edition, levels, entries };
}

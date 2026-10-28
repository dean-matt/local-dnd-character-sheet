import { experienceThreshold } from "@dnd/rules";
import type { CharacterDefinition } from "./definition.ts";
import { entryKey } from "./keys.ts";
import type { ContentRef, EntryRef } from "./refs.ts";

export const totalLevel = (definition: Pick<CharacterDefinition, "levels">): number =>
  definition.levels.length;

/**
 * An experience-mode definition holds at least its level's threshold, so a character
 * created above level 1, or stored before the floor existed, does not read as short of its
 * own level. A milestone character keeps its stored total.
 */
export function withExperienceFloor(definition: CharacterDefinition): CharacterDefinition {
  if (definition.leveling !== "xp") return definition;
  const floor = experienceThreshold(totalLevel(definition));
  return definition.experience >= floor ? definition : { ...definition, experience: floor };
}

/** Homebrew row names by id; ids are random UUIDs in every homebrew table, so one map spans the kinds. */
export type HomebrewNames = ReadonlyMap<string, string>;

/**
 * A homebrew ref carries only its `homebrewId`, so its name comes from `names`; one the map
 * lacks, still loading or deleted, reads `Homebrew`.
 */
export const displayName = (ref: EntryRef, names?: HomebrewNames): string =>
  "homebrewId" in ref ? (names?.get(ref.homebrewId) ?? "Homebrew") : ref.name;

/** The race with any subrace beside it — `Elf (High)`, or `Half-Elf` taken plain. */
export function raceSummary(definition: CharacterDefinition, names?: HomebrewNames): string {
  const subrace = definition.subrace ? ` (${definition.subrace.name})` : "";
  return `${displayName(definition.race, names)}${subrace}`;
}

/** One class a character has levels in, with the subclass named on any of those levels. */
type ClassLevels = { class: EntryRef; level: number; subclass?: ContentRef };

/** `levels` grouped by class, in the order each class was first taken. */
export function classLevels(definition: {
  levels: readonly CharacterDefinition["levels"][number][];
}): ClassLevels[] {
  const groups = new Map<string, ClassLevels>();
  for (const level of definition.levels) {
    const key = entryKey(level.class);
    const group = groups.get(key) ?? { class: level.class, level: 0 };
    group.level += 1;
    if (level.subclass) group.subclass = level.subclass;
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** One `classLevels` group with its count and any subclass — `Wizard 3 (Evoker)`. */
export function classLevelLabel(group: ClassLevels, names?: HomebrewNames): string {
  const subclass = group.subclass ? ` (${group.subclass.name})` : "";
  return `${displayName(group.class, names)} ${group.level}${subclass}`;
}

/**
 * `classLevels` joined as `levelEntrySchema`'s comment writes a multiclass character —
 * `Wizard 1 / Fighter 1`. A single class carries no count.
 */
export function classSummary(definition: CharacterDefinition, names?: HomebrewNames): string {
  const groups = classLevels(definition);
  const labels = groups.map((group) =>
    groups.length === 1
      ? displayName(group.class, names)
      : `${displayName(group.class, names)} ${group.level}`,
  );
  return labels.join(" / ");
}

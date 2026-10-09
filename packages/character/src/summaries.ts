import type { CharacterDefinition } from "./definition.ts";
import { entryKey } from "./keys.ts";
import type { ContentRef, EntryRef } from "./refs.ts";

export const totalLevel = (definition: Pick<CharacterDefinition, "levels">): number =>
  definition.levels.length;

/**
 * `race` and `levels[].class` carry only a `homebrewId` for a homebrew choice, and no
 * catalog reaches `packages/character` to resolve it to a name — the ceiling both
 * summaries below share.
 */
export const displayName = (ref: EntryRef): string => ("homebrewId" in ref ? "Homebrew" : ref.name);

/** The race with any subrace beside it — `Elf (High)`, or `Half-Elf` taken plain. */
export function raceSummary(definition: CharacterDefinition): string {
  const subrace = definition.subrace ? ` (${definition.subrace.name})` : "";
  return `${displayName(definition.race)}${subrace}`;
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
export function classLevelLabel(group: ClassLevels): string {
  const subclass = group.subclass ? ` (${group.subclass.name})` : "";
  return `${displayName(group.class)} ${group.level}${subclass}`;
}

/**
 * `classLevels` joined as `levelEntrySchema`'s comment writes a multiclass character —
 * `Wizard 1 / Fighter 1`. A single class carries no count.
 */
export function classSummary(definition: CharacterDefinition): string {
  const groups = classLevels(definition);
  const labels = groups.map((group) =>
    groups.length === 1 ? displayName(group.class) : `${displayName(group.class)} ${group.level}`,
  );
  return labels.join(" / ");
}

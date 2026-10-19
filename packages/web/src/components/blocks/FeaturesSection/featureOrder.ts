import type { FeatureGroup, SheetFeature } from "@dnd/catalog";
import { type CharacterDefinition, entryKey } from "@dnd/character";

type Entry = { feature: SheetFeature; group: FeatureGroup };

/**
 * Orders entries by the character level each was gained at, keeping the incoming order
 * among equals so a class's features come before its subclass's at one level and a
 * choice's options stay after their feature. An entry with no known level goes last.
 */
export function byLevelGained(entries: Entry[], levelOf: (entry: Entry) => number | undefined) {
  const rank = (entry: Entry) => levelOf(entry) ?? Number.POSITIVE_INFINITY;
  return entries
    .map((entry, index) => ({ entry, index, rank: rank(entry) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ entry }) => entry);
}

/**
 * The character level a class or subclass feature arrives at: the position in `levels` of
 * the class's Nth level, N being the feature's own class level. A class and its subclass
 * group both name the class they count.
 */
export function classFeatureLevel(
  levels: CharacterDefinition["levels"],
  { feature, group }: Entry,
): number | undefined {
  if (feature.level === undefined || !group.class) return undefined;
  const key = entryKey(group.class);
  let taken = 0;
  for (const [index, each] of levels.entries()) {
    if (entryKey(each.class) !== key) continue;
    taken += 1;
    if (taken === feature.level) return index + 1;
  }
  return undefined;
}

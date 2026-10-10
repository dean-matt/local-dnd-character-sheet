import type { FeatureGroup, SheetFeature } from "@dnd/catalog";
import { type CharacterDefinition, displayName, entryKey } from "@dnd/character";

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
 * the class's Nth level, N being the feature's own class level. A group names its class or
 * its subclass, so a subclass group finds its class through the level that chose it.
 */
export function classFeatureLevel(
  levels: CharacterDefinition["levels"],
  { feature, group }: Entry,
): number | undefined {
  if (feature.level === undefined) return undefined;
  const owner = levels.find((each) =>
    group.origin === "subclass"
      ? each.subclass?.name === group.name
      : displayName(each.class) === group.name,
  );
  if (!owner) return undefined;
  const key = entryKey(owner.class);
  let taken = 0;
  for (const [index, each] of levels.entries()) {
    if (entryKey(each.class) !== key) continue;
    taken += 1;
    if (taken === feature.level) return index + 1;
  }
  return undefined;
}

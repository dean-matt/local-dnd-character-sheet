import type { ClassGrants } from "@dnd/catalog";

type Table = Pick<ClassGrants, "optionalFeatures">;

/**
 * The options of each type a level adds, read off one table's running totals before and
 * after it: `known` counts every option held, so a level adds the difference.
 */
export function optionsGained(before: Table | undefined, after: Table | undefined) {
  return (after?.optionalFeatures ?? []).flatMap(({ featureType, known }) => {
    const was = before?.optionalFeatures.find((each) => each.featureType === featureType);
    const count = known - (was?.known ?? 0);
    return count > 0 ? [{ featureType, count }] : [];
  });
}

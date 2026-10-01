import { collectFluff, fluffKey, isFluffPath } from "./fluff.ts";
import { type Entry, text } from "./json.ts";

export const CLASS_FLUFF = "data/class/fluff-class-*.json";

/** Every class's and every subclass's fluff, pooled across the one file per class. */
export function fluffPools(files: [string, unknown][]): {
  classes: (key: string) => Entry | undefined;
  subclasses: (key: string) => Entry | undefined;
} {
  const fluffFiles = files.filter(([path]) => isFluffPath(path));
  return {
    classes: collectFluff(fluffFiles, "classFluff", (entry, context) =>
      fluffKey(text(entry, "name", context), text(entry, "source", context)),
    ),
    subclasses: collectFluff(fluffFiles, "subclassFluff", (entry, context) =>
      fluffKey(
        text(entry, "name", context),
        text(entry, "source", context),
        text(entry, "className", context),
      ),
    ),
  };
}

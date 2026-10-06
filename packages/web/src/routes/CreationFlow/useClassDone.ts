import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { subclassOf } from "./classLevels.ts";
import { stepOf } from "./creationSteps.ts";
import { useClassCatalog } from "./useClassCatalog.ts";

/**
 * Whether the Class step is finished: Finish would find no fault in a value it sets, the
 * class resolves, and a level that has reached the subclass names one of the class's own.
 */
export function useClassDone(): boolean {
  const values = useWatch<CharacterDefinition>();
  const { catalogClass, classRow, homebrew, levels, subclassLevel, subclasses } = useClassCatalog();
  const parsed = characterDefinitionSchema.safeParse(values);
  const faulted = parsed.error?.issues.some(
    (issue) => stepOf(String(issue.path[0] ?? ""))?.slug === "class",
  );
  if (faulted) return false;
  if (catalogClass === undefined) return homebrew.isSuccess;
  if (!classRow.isSuccess || subclasses.data === undefined) return false;
  if (subclassLevel === undefined || levels.length < subclassLevel) return true;
  const rows = subclasses.data.items;
  const chosen = subclassOf(levels);
  return (
    rows.length === 0 ||
    rows.some((row) => chosen && row.name === chosen.name && row.source === chosen.source)
  );
}

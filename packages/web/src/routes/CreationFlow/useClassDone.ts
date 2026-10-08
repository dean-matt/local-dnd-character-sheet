import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { stepOf } from "./creationSteps.ts";
import { type ClassEntry, useClassEntries } from "./useClassEntries.ts";

/** A class resolves, and a level that has reached its subclass names one of the class's own. */
function classDone(entry: ClassEntry): boolean {
  if (!entry.read) return false;
  if (entry.catalogClass === undefined) return true;
  const { subclasses, subclass, subclassLevel, level } = entry;
  if (subclasses === undefined) return false;
  if (subclassLevel === undefined || level < subclassLevel) return true;
  return (
    subclasses.length === 0 ||
    subclasses.some(
      (row) => subclass && row.name === subclass.name && row.source === subclass.source,
    )
  );
}

/**
 * Whether the Class step is finished: Finish would find no fault in a value it sets, and
 * the draft holds a class, each of which `classDone` passes.
 */
export function useClassDone(): boolean {
  const values = useWatch<CharacterDefinition>();
  const { entries } = useClassEntries();
  const parsed = characterDefinitionSchema.safeParse(values);
  const faulted = parsed.error?.issues.some(
    (issue) => stepOf(String(issue.path[0] ?? ""))?.slug === "class",
  );
  return !faulted && entries.length > 0 && entries.every(classDone);
}

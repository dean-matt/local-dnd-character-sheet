import { type CharacterDefinition, characterDefinitionSchema, entryKey } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { takenOption } from "../../lib/featureChoices.ts";
import type { FeatureOffering } from "../../lib/featureOfferings.ts";
import { subclassRef } from "../../lib/subclassItems.ts";
import { stepOf } from "./creationSteps.ts";
import { type ClassEntry, useClassEntries } from "./useClassEntries.ts";
import { useFeatureOfferings } from "./useFeatureOfferings.ts";

/** A class resolves, and a level that has reached its subclass names one of the class's own. */
function classDone(entry: ClassEntry): boolean {
  if (!entry.read) return false;
  const { subclasses, subclass, subclassLevel, level } = entry;
  if (subclassLevel === undefined || level < subclassLevel) return true;
  if (subclasses === undefined) return false;
  return (
    subclasses.length === 0 ||
    subclasses.some((row) => subclass && entryKey(subclassRef(row)) === entryKey(subclass))
  );
}

/** Each offering holds a stored option it still offers. */
function chosen(
  offerings: readonly FeatureOffering[],
  choices: CharacterDefinition["featureChoices"] | undefined,
): boolean {
  return offerings.every(
    ({ feature, options }) => takenOption(choices, feature, options) !== undefined,
  );
}

/**
 * Whether the Class step is finished: Finish would find no fault in a value it sets, and
 * the draft holds a class, each of which `classDone` passes and has made every choice its
 * features offer.
 */
export function useClassDone(): boolean {
  const values = useWatch<CharacterDefinition>();
  const choices = useWatch<CharacterDefinition, "featureChoices">({ name: "featureChoices" });
  const { entries } = useClassEntries();
  const { offerings, read } = useFeatureOfferings(entries);
  const parsed = characterDefinitionSchema.safeParse(values);
  const faulted = parsed.error?.issues.some(
    (issue) => stepOf(String(issue.path[0] ?? ""))?.slug === "class",
  );
  return (
    !faulted &&
    read &&
    entries.length > 0 &&
    entries.every((entry, index) => classDone(entry) && chosen(offerings[index] ?? [], choices))
  );
}

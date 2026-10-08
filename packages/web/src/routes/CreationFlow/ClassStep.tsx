import { type CharacterDefinition, type EntryRef, entryKey } from "@dnd/character";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { AddClassField } from "./AddClassField.tsx";
import { ClassField } from "./ClassField.tsx";
import { ClassRow } from "./ClassRow.tsx";
import { HIGHEST_LEVEL, withClassCount } from "./classLevels.ts";
import { CLASS_FIELD, withDeparture } from "./departures.ts";
import { HitPointsField, type HitPointsFieldProps } from "./HitPointsField.tsx";
import { useClassEntries } from "./useClassEntries.ts";

const OPTS = { shouldDirty: true } as const;

/**
 * What the character does: each class with its level and subclass on the left, the
 * character level they sum to, and hit points on the right. Clearing the only class keeps
 * its level for the class picked next.
 */
export function ClassStep(hitPoints: HitPointsFieldProps) {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const { edition, levels, entries } = useClassEntries();
  const [count, setCount] = useState(Math.max(levels.length, 1));
  // What takes focus once it mounts: a class's row, or the picker a cleared class gave way to.
  const [focus, setFocus] = useState<string>();
  const [addFocus, setAddFocus] = useState(0);
  const multiclassed = entries.length > 1;

  const picked = (ref: EntryRef) => setFocus(entryKey(ref));
  function remove(cls: EntryRef, level: number) {
    const next = withClassCount(getValues("levels") ?? [], cls, 0);
    setValue("levels", next, OPTS);
    if (!next.some((each) => "homebrewId" in each.class))
      setValue("departures", withDeparture(getValues("departures"), CLASS_FIELD), OPTS);
    if (next.length > 0) setAddFocus((request) => request + 1);
    else {
      setCount(level);
      setFocus("picker");
    }
  }

  return (
    <div className="grid gap-7 sm:grid-cols-2">
      <div className="flex flex-col gap-4">
        {entries.length === 0 ? (
          <ClassField
            edition={edition}
            count={count}
            focusOnMount={focus === "picker"}
            onPicked={picked}
          />
        ) : (
          <>
            {entries.map((entry, index) => (
              <ClassRow
                key={entryKey(entry.cls)}
                entry={entry}
                first={index === 0}
                multiclassed={multiclassed}
                max={HIGHEST_LEVEL - (levels.length - entry.level)}
                focusOnMount={focus === entryKey(entry.cls)}
                onRemove={() => remove(entry.cls, entry.level)}
              />
            ))}
            <AddClassField edition={edition} focusRequest={addFocus} onAdded={picked} />
            <p className="text-body">
              Character level <strong>{levels.length}</strong>
            </p>
          </>
        )}
      </div>
      <HitPointsField {...hitPoints} />
    </div>
  );
}

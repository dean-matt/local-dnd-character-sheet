import type { CharacterDefinition, ContentRef } from "@dnd/character";
import { useFormContext } from "react-hook-form";
import { ChoicePills } from "./ChoicePills.tsx";
import { withSubclass } from "./classLevels.ts";
import type { ClassEntry } from "./useClassEntries.ts";

const subclassKey = (row: ContentRef) => `${row.name}|${row.source}`;

/**
 * A class's subclass, offered once its level reaches the one the class grants it at — 1st
 * for `Cleric` (PHB), 3rd for `Cleric` (XPHB) — and named before then as the level it waits
 * on. It is stored on that level of the class.
 */
export function SubclassField({ entry, legend }: { entry: ClassEntry; legend: string }) {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const { catalogClass, subclassLevel, level, subclass } = entry;
  if (catalogClass === undefined || subclassLevel === undefined) return null;
  if (level < subclassLevel) {
    return (
      <p className="text-muted text-row">
        {catalogClass.name} chooses a subclass at level {subclassLevel}.
      </p>
    );
  }
  const rows = entry.subclasses ?? [];
  if (rows.length === 0) return null;
  return (
    <ChoicePills
      legend={legend}
      prompting={!rows.some((row) => subclass && subclassKey(row) === subclassKey(subclass))}
      options={rows.map((row) => ({ value: subclassKey(row), label: row.name }))}
      value={subclass && subclassKey(subclass)}
      onChange={(value) => {
        const row = rows.find((each) => subclassKey(each) === value);
        const ref = row && { name: row.name, source: row.source };
        setValue("levels", withSubclass(getValues("levels"), entry.cls, ref, subclassLevel), {
          shouldDirty: true,
        });
      }}
    />
  );
}

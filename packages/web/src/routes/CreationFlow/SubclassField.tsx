import { type CharacterDefinition, entryKey } from "@dnd/character";
import { useFormContext } from "react-hook-form";
import { ChoicePills } from "../../components/ChoicePills.tsx";
import { subclassLabel, subclassRef } from "../../lib/subclassItems.ts";
import { withSubclass } from "./classLevels.ts";
import type { ClassEntry } from "./useClassEntries.ts";

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
  const key = (row: (typeof rows)[number]) => entryKey(subclassRef(row));
  return (
    <ChoicePills
      legend={legend}
      prompting={!rows.some((row) => subclass && key(row) === entryKey(subclass))}
      options={rows.map((row) => ({ value: key(row), label: subclassLabel(row) }))}
      value={subclass && entryKey(subclass)}
      onChange={(value) => {
        const row = rows.find((each) => key(each) === value);
        setValue(
          "levels",
          withSubclass(getValues("levels"), entry.cls, row && subclassRef(row), subclassLevel),
          { shouldDirty: true },
        );
      }}
    />
  );
}

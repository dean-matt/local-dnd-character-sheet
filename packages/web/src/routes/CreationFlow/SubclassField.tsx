import type { CharacterDefinition, ContentRef } from "@dnd/character";
import { useFormContext } from "react-hook-form";
import { ChoicePills } from "./ChoicePills.tsx";
import { subclassOf, withSubclass } from "./classLevels.ts";
import { useClassCatalog } from "./useClassCatalog.ts";

const subclassKey = (row: ContentRef) => `${row.name}|${row.source}`;

/**
 * The subclass, offered once the level reaches the one the class grants it at — 1st for
 * `Cleric` (PHB), 3rd for `Cleric` (XPHB) — and named before then as the level it waits on.
 * It is stored on that level.
 */
export function SubclassField() {
  const { setValue } = useFormContext<CharacterDefinition>();
  const { levels, catalogClass, subclassLevel, subclasses } = useClassCatalog();
  if (catalogClass === undefined || subclassLevel === undefined) return null;
  if (levels.length < subclassLevel) {
    return (
      <p className="text-muted text-row">
        {catalogClass.name} chooses a subclass at level {subclassLevel}.
      </p>
    );
  }
  const rows = subclasses.data?.items ?? [];
  if (rows.length === 0) return null;
  const chosen = subclassOf(levels);
  return (
    <ChoicePills
      legend="Subclass"
      prompting={!rows.some((row) => chosen && subclassKey(row) === subclassKey(chosen))}
      options={rows.map((row) => ({ value: subclassKey(row), label: row.name }))}
      value={chosen && subclassKey(chosen)}
      onChange={(value) => {
        const row = rows.find((each) => subclassKey(each) === value);
        const ref = row && { name: row.name, source: row.source };
        setValue("levels", withSubclass(levels, ref, subclassLevel), { shouldDirty: true });
      }}
    />
  );
}

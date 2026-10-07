import {
  backgroundStartingEquipmentSchema,
  classStartingEquipmentSchema,
  type EquipmentItem,
  type RefQuery,
  type StartingEquipment,
} from "@dnd/catalog";
import { useResolvedRefs } from "../../hooks/useResolvedRefs.ts";
import type { EquipmentSource, OfferedItem } from "./equipmentPicks.ts";
import { CORE_SOURCE, titleCase } from "./grants.ts";

/** The edition's core book, then the other edition's, which prints what it leaves out. */
const coreBooks = (edition: keyof typeof CORE_SOURCE) =>
  edition === "one"
    ? [CORE_SOURCE.one, CORE_SOURCE.classic]
    : [CORE_SOURCE.classic, CORE_SOURCE.one];

import { useClassCatalog } from "./useClassCatalog.ts";
import { useIdentityCatalog } from "./useIdentityCatalog.ts";

type Unresolved = Omit<EquipmentSource, "groups"> & { equipment: StartingEquipment };

/**
 * The starting equipment the first level's class and the background hand over, each item
 * resolved against the catalog, case and all, since upstream writes `dagger|xphb` for the
 * row `Dagger`. A thing upstream names no row for is looked up by its name in the
 * edition's core book, then the other edition's: the 2024 Wizard's spellbook is printed
 * only as `Spellbook` (PHB). A quill resolves in neither. A homebrew
 * class or background lists none. `undefined` while a row it reads has not loaded, a
 * failed read included.
 */
export function useEquipmentSources(): EquipmentSource[] | undefined {
  const { edition, backgroundRow, backgrounds } = useIdentityCatalog();
  const { catalogClass, classRow } = useClassCatalog();
  const classJson = classRow.data?.json;
  const unresolved: Unresolved[] = [
    ...(catalogClass && classJson
      ? [
          {
            by: "Class" as const,
            row: `${catalogClass.name}|${catalogClass.source}`,
            name: catalogClass.name,
            equipment: classStartingEquipmentSchema.parse(classJson),
          },
        ]
      : []),
    ...(backgroundRow
      ? [
          {
            by: "Background" as const,
            row: `${backgroundRow.name}|${backgroundRow.source}`,
            name: backgroundRow.name,
            equipment: backgroundStartingEquipmentSchema.parse(backgroundRow.json),
          },
        ]
      : []),
  ];
  const named = (item: EquipmentItem): RefQuery[] =>
    item.kind === "item"
      ? [{ tag: "item", name: item.name, source: item.source }]
      : item.kind === "special"
        ? coreBooks(edition).map((source) => ({ tag: "item", name: item.name, source }))
        : [];
  const queries = unresolved.flatMap(({ equipment }) =>
    equipment.groups.flatMap((group) => group.flatMap((option) => option.items.flatMap(named))),
  );
  const resolved = useResolvedRefs(queries);
  const classRead = catalogClass === undefined || classRow.isSuccess;
  if (!classRead || !backgrounds.isSuccess || (queries.length > 0 && !resolved.isSuccess))
    return undefined;

  const rows = resolved.data ?? [];
  let next = 0;
  const offered = (item: EquipmentItem): OfferedItem => {
    if (item.kind === "money" || item.kind === "type") return item;
    const asked = item.kind === "item" ? 1 : 2;
    const tried = rows.slice(next, next + asked);
    next += asked;
    const row = tried.find((each) => each !== null && each !== undefined);
    const ref = row ? { name: row.name, source: row.source } : undefined;
    const fallback = item.kind === "item" ? titleCase(item.name) : item.name;
    const label = (item.kind === "item" && item.label) || ref?.name || fallback;
    return { kind: "item", ref, label, quantity: item.quantity };
  };
  return unresolved.map(({ equipment, ...source }) => ({
    ...source,
    groups: equipment.groups.map((group) =>
      group.map((option) => ({ key: option.key, items: option.items.map(offered) })),
    ),
    ...(equipment.goldAlternative && { goldAlternative: equipment.goldAlternative }),
  }));
}

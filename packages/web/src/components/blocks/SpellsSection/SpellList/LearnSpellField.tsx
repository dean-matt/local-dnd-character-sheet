import { casterProgressionSchema, type SearchHit } from "@dnd/catalog";
import {
  type CharacterDerived,
  type CharacterRecord,
  type ContentRef,
  classLevels,
  displayName,
  type EntryRef,
  entryKey,
} from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { classQuery } from "../../../../hooks/classQuery.ts";
import { useClassGrants } from "../../../../hooks/useClassGrants.ts";
import { useClassSpellList } from "../../../../hooks/useClassSpellList.ts";
import { useSubclassGrants } from "../../../../hooks/useSubclassGrants.ts";
import { castableCeiling } from "../../../../lib/casterFacts.ts";
import { searchHitKey } from "../../../../lib/searchHitKey.ts";
import { CatalogPicker } from "../../../CatalogPicker/CatalogPicker.tsx";
import { FormField } from "../../../FormField.tsx";
import { Select } from "../../../Select.tsx";
import { spellCaster } from "./spellCaster.ts";

type Caster = CharacterDerived["spellcasting"][number];

type Ref = { name: string; source: string };

/**
 * The spells on `list` above `castableCeiling` at the class's level, its subclass's table
 * counted. An empty set where nothing is above; `undefined` while the tables or the list load.
 */
function useTooHigh(
  edition: CharacterRecord["edition"],
  list: { class: Ref; subclass?: Ref; level: number } | undefined,
) {
  const level = list?.level ?? 1;
  const own = useClassGrants(list?.class, level);
  const sub = useSubclassGrants(list?.class, list?.subclass, level);
  const row = useQuery(classQuery(list?.class));
  const loaded =
    own.data !== undefined && row.data !== undefined && (!list?.subclass || sub.data !== undefined);
  const tables = [own.data, sub.data].flatMap((table) => table ?? []);
  const maxLevel =
    loaded && row.data !== undefined
      ? castableCeiling(tables, casterProgressionSchema.parse(row.data.json) === "pact", level)
      : undefined;
  const above = useClassSpellList(
    edition,
    list,
    maxLevel === undefined || maxLevel >= 9 ? undefined : maxLevel + 1,
  );
  return {
    failed: own.isError || sub.isError || row.isError || above.isError,
    keys: maxLevel !== undefined && maxLevel >= 9 ? new Set<string>() : above.data,
  };
}

/** Why the class `name` cannot take a catalog spell, if it cannot. */
function listReason(
  name: string,
  listed: ReturnType<typeof useClassSpellList>,
  tooHigh: ReturnType<typeof useTooHigh>,
  key: string,
): string | undefined {
  if (listed.isError || tooHigh.failed) return `Couldn't read the ${name} spell list`;
  if (!listed.data || !tooHigh.keys) return `Checking the ${name} spell list…`;
  if (!listed.data.has(key)) return `Not on the ${name} spell list`;
  return tooHigh.keys.has(key) ? `Above the highest level a ${name} slot casts` : undefined;
}

/**
 * Learns a spell for one casting class, chosen first where more than one casts. The picker
 * offers every spell. One the class's list does not hold, with its subclass's additions at
 * the class level, or one above the level the class's slots cast, says why and cannot be
 * picked. A homebrew spell is on no list and stays open to every class; a
 * homebrew class has no list to read, so it takes any spell. The spell lands unprepared,
 * with the class as its origin.
 */
export function LearnSpellField({
  character,
  casters,
  onLearn,
}: {
  character: CharacterRecord;
  casters: readonly Caster[];
  onLearn: (ref: EntryRef, origin: ContentRef | undefined) => void;
}) {
  const { definition } = character;
  const [chosen, setChosen] = useState(0);
  const caster = casters[chosen] ?? casters[0];
  const cls = caster && "name" in caster.class ? caster.class : undefined;
  const group =
    cls && classLevels(definition).find((each) => entryKey(each.class) === entryKey(cls));
  const list = cls &&
    group && {
      class: cls,
      ...(group.subclass && { subclass: group.subclass }),
      level: group.level,
    };
  const listed = useClassSpellList(definition.edition, list);
  const tooHigh = useTooHigh(definition.edition, list);
  const name = caster ? displayName(caster.class) : "";
  const known = new Set(
    definition.spells
      .filter((spell) => spellCaster(spell, casters) === caster)
      .map((spell) => entryKey(spell.ref)),
  );
  const unavailableReason = (hit: SearchHit) => {
    if (known.has(searchHitKey(hit))) return "Known already";
    if ("id" in hit || !list) return undefined;
    return listReason(name, listed, tooHigh, searchHitKey(hit));
  };

  return (
    <div className="flex flex-col gap-1.5">
      {casters.length > 1 && (
        <FormField label="Learn as">
          {(control) => (
            <Select
              {...control}
              value={String(chosen)}
              options={casters.map((each, index) => ({
                value: String(index),
                label: displayName(each.class),
              }))}
              onChange={(next) => setChosen(Number(next))}
            />
          )}
        </FormField>
      )}
      <CatalogPicker
        label={casters.length > 0 ? `Learn a ${name} spell` : "Learn a spell"}
        edition={definition.edition}
        type="spell"
        unavailableReason={unavailableReason}
        // A homebrew class cannot be an `origin`, which holds a catalog reference, so its
        // spell saves with none and `spellCaster` gives it to the first class that casts. A
        // homebrew `origin` in the definition schema is the way out.
        onPick={(ref) => onLearn(ref, cls)}
        placeholder="Search spells…"
      />
    </div>
  );
}

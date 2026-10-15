import type { SearchHit } from "@dnd/catalog";
import {
  type CharacterDerived,
  type CharacterRecord,
  type ContentRef,
  classLevels,
  displayName,
  type EntryRef,
  entryKey,
} from "@dnd/character";
import { useState } from "react";
import { useClassSpellList } from "../../../../hooks/useClassSpellList.ts";
import { searchHitKey } from "../../../../lib/searchHitKey.ts";
import { CatalogPicker } from "../../../CatalogPicker/CatalogPicker.tsx";
import { FormField } from "../../../FormField.tsx";
import { Select } from "../../../Select.tsx";
import { spellCaster } from "./spellCaster.ts";

type Caster = CharacterDerived["spellcasting"][number];

/** Why the class `name` cannot take a catalog spell its list may not hold, if it cannot. */
function listReason(
  name: string,
  listed: ReturnType<typeof useClassSpellList>,
  key: string,
): string | undefined {
  if (listed.isError) return `Couldn't read the ${name} spell list`;
  if (!listed.data) return `Checking the ${name} spell list…`;
  return listed.data.has(key) ? undefined : `Not on the ${name} spell list`;
}

/**
 * Learns a spell for one casting class, chosen first where more than one casts. The picker
 * offers every spell, and one the class's list does not hold, at its subclass's level, says
 * so and cannot be picked. A homebrew spell is on no list and stays open to every class; a
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
  const name = caster ? displayName(caster.class) : "";
  const known = new Set(
    definition.spells
      .filter((spell) => spellCaster(spell, casters) === caster)
      .map((spell) => entryKey(spell.ref)),
  );
  const unavailableReason = (hit: SearchHit) => {
    if (known.has(searchHitKey(hit))) return "Known already";
    if ("id" in hit || !list) return undefined;
    return listReason(name, listed, searchHitKey(hit));
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
        onPick={(ref) => onLearn(ref, cls)}
        placeholder="Search spells…"
      />
    </div>
  );
}

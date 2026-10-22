import type { SearchHit } from "@dnd/catalog";
import { type CharacterDefinition, displayName, type EntryRef, entryKey } from "@dnd/character";
import { useCatalogSearch } from "../../../hooks/useCatalogSearch.ts";
import { searchHitKey, searchHitRef } from "../../../lib/searchHitKey.ts";
import { FormField } from "../../FormField.tsx";
import { Select } from "../../Select.tsx";

const hitSource = (hit: SearchHit) => ("id" in hit ? "homebrew" : hit.source);
// Above every class one edition and the homebrew hold together, as the level-up's list is.
const CLASS_LIMIT = 200;

export interface StartingClassFieldProps {
  edition: CharacterDefinition["edition"];
  /** The class level 1 holds in the draft. */
  value: EntryRef;
  onChange: (cls: EntryRef) => void;
}

/** Level 1's class, from every class the edition and the homebrew offer. */
export function StartingClassField({ edition, value, onChange }: StartingClassFieldProps) {
  const classes = useCatalogSearch({
    edition,
    type: "class",
    query: "",
    limit: CLASS_LIMIT,
    listAll: true,
  });
  const hits = classes.data?.items ?? [];
  const names = hits.map((hit) => hit.name);
  const shared = new Set(names.filter((name, index) => names.indexOf(name) !== index));
  const current = entryKey(value);
  const listed = hits.some((hit) => searchHitKey(hit) === current);
  return (
    <>
      <FormField label="Starting class">
        {(control) => (
          <Select
            {...control}
            options={[
              ...(listed ? [] : [{ value: current, label: displayName(value) }]),
              ...hits.map((hit) => ({
                value: searchHitKey(hit),
                label: shared.has(hit.name) ? `${hit.name} (${hitSource(hit)})` : hit.name,
              })),
            ]}
            value={current}
            onChange={(key) => {
              const hit = hits.find((each) => searchHitKey(each) === key);
              if (hit) onChange(searchHitRef(hit));
            }}
          />
        )}
      </FormField>
      {classes.isError && <p className="text-error">Couldn't load the classes.</p>}
    </>
  );
}

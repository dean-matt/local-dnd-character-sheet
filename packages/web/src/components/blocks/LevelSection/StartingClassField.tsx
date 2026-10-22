import { type CharacterDefinition, displayName, type EntryRef, entryKey } from "@dnd/character";
import { searchHitKey, searchHitRef } from "../../../lib/searchHitKey.ts";
import { FormField } from "../../FormField.tsx";
import { Select } from "../../Select.tsx";
import { useClassList } from "./useClassList.ts";

export interface StartingClassFieldProps {
  edition: CharacterDefinition["edition"];
  /** The class level 1 holds in the draft. */
  value: EntryRef;
  onChange: (cls: EntryRef) => void;
}

/** Level 1's class, from every class the edition and the homebrew offer. */
export function StartingClassField({ edition, value, onChange }: StartingClassFieldProps) {
  const { hits, failed, label } = useClassList(edition);
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
                label: label(hit),
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
      {failed && <p className="text-error">Couldn't load the classes.</p>}
    </>
  );
}

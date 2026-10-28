import { type CharacterDefinition, displayName, type EntryRef, entryKey } from "@dnd/character";
import { useHomebrewNames } from "../../../hooks/useHomebrewNames.ts";
import { searchHitKey, searchHitRef } from "../../../lib/searchHitKey.ts";
import { FormField } from "../../FormField.tsx";
import { Select } from "../../Select.tsx";
import { useClassList } from "./useClassList.ts";

export interface LevelClassFieldProps {
  edition: CharacterDefinition["edition"];
  /** The character level whose class this is, counting from 1. */
  level: number;
  value: EntryRef;
  onChange: (cls: EntryRef) => void;
}

/** A level's class, from every class the edition and the homebrew offer. */
export function LevelClassField({ edition, level, value, onChange }: LevelClassFieldProps) {
  const names = useHomebrewNames();
  const { hits, failed, label } = useClassList(edition);
  const current = entryKey(value);
  const listed = hits.some((hit) => searchHitKey(hit) === current);
  return (
    <>
      <FormField label={level === 1 ? "Starting class" : "Class"}>
        {(control) => (
          <Select
            {...control}
            options={[
              ...(listed ? [] : [{ value: current, label: displayName(value, names) }]),
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

import { useState } from "react";
import { InputField } from "../InputField.tsx";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { ROW, ROW_BUTTON } from "./homebrewRows.ts";
import { type TypeTagRow, typeTagRows, withTypeTags } from "./monsterShapes.ts";

interface MonsterTypeTagsProps {
  type: unknown;
  onChange: (type: unknown) => void;
}

/** A monster's type tags, a row to each with its tag and the prefix written before it. */
export function MonsterTypeTags({ type, onChange }: MonsterTypeTagsProps) {
  const [rows, setRows] = useState(() => typeTagRows(type));
  const write = (next: TypeTagRow[]) => {
    setRows(next);
    onChange(withTypeTags(type, next));
  };
  const replace = (index: number, change: Partial<TypeTagRow>) =>
    write(rows.map((row, at) => (at === index ? { ...row, ...change } : row)));
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-muted text-row">Type tags</legend>
      {rows.map((row, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a row has no id, and the list only grows or shrinks at a row the user picked.
        <div key={index} className={ROW}>
          <InputField
            label={`Type tag ${index + 1}`}
            placeholder="dwarf"
            value={row.tag}
            onChange={(event) => replace(index, { tag: event.target.value })}
          />
          <InputField
            label={`Type tag ${index + 1} prefix`}
            placeholder="shield"
            value={row.prefix}
            onChange={(event) => replace(index, { prefix: event.target.value })}
          />
          <HomebrewRowRemove
            name={`type tag ${index + 1}`}
            onRemove={() => write(rows.filter((_, at) => at !== index))}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => write([...rows, { tag: "", prefix: "", stored: undefined }])}
        className={`self-start ${ROW_BUTTON}`}
      >
        Add a type tag
      </button>
    </fieldset>
  );
}

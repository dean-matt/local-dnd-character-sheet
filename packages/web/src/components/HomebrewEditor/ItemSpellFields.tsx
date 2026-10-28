import { type ReactNode, useState } from "react";
import { InputField } from "../InputField.tsx";
import { RemovableChipList } from "../RemovableChipList.tsx";
import { ROW, ROW_BUTTON } from "./homebrewRows.ts";

/**
 * The spells an item lets its bearer cast, written as `attachedSpells` holds them: a list
 * of names, each `name` or `name|source`. A name already listed is not added twice.
 */
export function ItemSpellFields({
  spells,
  onChange,
  error,
}: {
  spells: readonly string[];
  onChange: (next: string[]) => void;
  error?: ReactNode;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const name = draft.trim();
    setDraft("");
    if (name && !spells.includes(name)) onChange([...spells, name]);
  };
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-muted text-row">Spells</legend>
      <RemovableChipList
        items={spells.map((spell) => ({ key: spell, label: spell }))}
        onRemove={(key) => onChange(spells.filter((spell) => spell !== key))}
      />
      <div className={ROW}>
        <InputField
          label="Spell"
          placeholder="Name, or name|source"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            add();
          }}
        />
        <button type="button" onClick={add} className={ROW_BUTTON}>
          Add a spell
        </button>
      </div>
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
    </fieldset>
  );
}

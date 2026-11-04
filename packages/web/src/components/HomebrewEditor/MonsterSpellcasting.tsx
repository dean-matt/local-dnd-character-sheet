import { useRef } from "react";
import { isRecord } from "../../lib/entryGuards.ts";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { type HomebrewFormProps, listAt, withField } from "./homebrewEntry.ts";
import { ROW_BUTTON } from "./homebrewRows.ts";
import { MonsterSpellcastingBlock } from "./MonsterSpellcastingBlock.tsx";
import { NEW_SPELLCASTING } from "./monsterSpellcasting.ts";

/**
 * A monster's spellcasting blocks, each added, edited and removed. A block that is not an
 * object stays as stored, can still be removed, and is edited in JSON.
 */
export function MonsterSpellcasting({ entry, edition, onChange, errorFor }: HomebrewFormProps) {
  const stored = entry.spellcasting;
  const list = listAt(entry, "spellcasting");
  const ids = useRef<number[]>([]);
  const next = useRef(0);
  while (ids.current.length < list.length) ids.current.push(next.current++);
  const error = errorFor("spellcasting");
  if (stored !== undefined && !Array.isArray(stored)) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-muted text-row">Spellcasting</span>
        <p className="text-muted text-row">
          These are stated in a shape the form cannot show. Edit them in JSON.
        </p>
        {error && (
          <p role="alert" className="text-error text-row">
            {error}
          </p>
        )}
      </div>
    );
  }
  const write = (blocks: unknown[]) =>
    onChange(withField(entry, "spellcasting", blocks.length > 0 ? blocks : undefined));
  const remove = (index: number) => {
    ids.current.splice(index, 1);
    write(list.filter((_, at) => at !== index));
  };
  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="sr-only">Spellcasting</legend>
      <ul className="flex flex-col gap-3">
        {list.map((block, index) => {
          const label = `Spellcasting ${index + 1}`;
          const name = `spellcasting block ${index + 1}`;
          return (
            <li
              key={ids.current[index]}
              className="flex flex-col gap-2 rounded-control border border-border p-2"
            >
              {isRecord(block) && !Array.isArray(block) ? (
                <MonsterSpellcastingBlock
                  label={label}
                  name={name}
                  block={block}
                  edition={edition}
                  onBlock={(changed) =>
                    write(list.map((each, at) => (at === index ? changed : each)))
                  }
                  onRemove={() => remove(index)}
                />
              ) : (
                <div className="flex items-end gap-2">
                  <p className="min-w-0 flex-1 text-muted text-row">
                    {label} is stated in a shape the form cannot show. Edit it in JSON.
                  </p>
                  <HomebrewRowRemove name={name} onRemove={() => remove(index)} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => write([...list, { ...NEW_SPELLCASTING }])}
        className={`self-start ${ROW_BUTTON}`}
      >
        Add a spellcasting block
      </button>
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
    </fieldset>
  );
}

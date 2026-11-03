import { ArrowDown, ArrowUp } from "lucide-react";
import { type ComponentType, useRef } from "react";
import { InputField } from "../InputField.tsx";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { HomebrewRulesText } from "./HomebrewRulesText.tsx";
import {
  entriesOf,
  type HomebrewFormProps,
  listAt,
  paragraphsOf,
  withField,
} from "./homebrewEntry.ts";
import { ROW_BUTTON } from "./homebrewRows.ts";
import { isPlainTextRow, type MonsterTextGroup, moved } from "./monsterShapes.ts";

const MOVE =
  "flex w-8 items-center justify-center self-stretch rounded-control text-muted hover:bg-subtle disabled:opacity-40";

interface Group {
  key: MonsterTextGroup;
  /** What one row is, singular and lowercase: `trait`. */
  noun: string;
  legend: string;
}

/**
 * The form for one group of a monster's stat block, such as its traits: a row each with a name
 * and rules text written as paragraphs, which can be moved and removed. A row holding a list,
 * a table or any other shape stays as stored, can still be moved or removed, and is edited in
 * JSON. Every row stays where it was stored, so an edit never reorders the list.
 */
function monsterTextBlocks({ key, noun, legend }: Group): ComponentType<HomebrewFormProps> {
  return function MonsterTextBlocks({ entry, onChange, errorFor }: HomebrewFormProps) {
    const stored = entry[key];
    const list = listAt(entry, key);
    const ids = useRef<number[]>([]);
    const next = useRef(0);
    while (ids.current.length < list.length) ids.current.push(next.current++);
    const error = errorFor(key);
    if (stored !== undefined && !Array.isArray(stored)) {
      return (
        <div className="flex flex-col">
          <span className="mb-1 text-muted text-row">{legend}</span>
          <p className="text-muted text-row">
            These are stated in a shape the form cannot show. Edit them in JSON.
          </p>
        </div>
      );
    }
    const write = (rows: unknown[]) =>
      onChange(withField(entry, key, rows.length > 0 ? rows : undefined));
    const replace = (index: number, change: Record<string, unknown>) =>
      write(
        list.map((row, at) => {
          if (at !== index) return row;
          const merged = { ...(row as Record<string, unknown>), ...change };
          if (merged.entries === undefined) delete merged.entries;
          return merged;
        }),
      );
    const move = (from: number, to: number) => {
      ids.current = moved(ids.current, from, to);
      write(moved(list, from, to));
    };
    return (
      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="sr-only">{legend}</legend>
        <ul className="flex flex-col gap-3">
          {list.map((row, index) => {
            const label = `${legend} ${index + 1}`;
            const plain = isPlainTextRow(row);
            const name = plain ? (row.name ?? "") : "";
            return (
              <li
                key={ids.current[index]}
                className="flex flex-col gap-2 rounded-control border border-border p-2"
              >
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    {plain ? (
                      <InputField
                        label={`${label} name`}
                        value={name}
                        onChange={(event) => replace(index, { name: event.target.value })}
                      />
                    ) : (
                      <p className="text-muted text-row">
                        {label} is stated in a shape the form cannot show. Edit it in JSON.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`Move ${noun} ${index + 1} up`}
                    title="Move up"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                    className={MOVE}
                  >
                    <ArrowUp aria-hidden size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${noun} ${index + 1} down`}
                    title="Move down"
                    disabled={index === list.length - 1}
                    onClick={() => move(index, index + 1)}
                    className={MOVE}
                  >
                    <ArrowDown aria-hidden size={16} />
                  </button>
                  <HomebrewRowRemove
                    name={`${noun} ${index + 1}`}
                    onRemove={() => {
                      ids.current.splice(index, 1);
                      write(list.filter((_, at) => at !== index));
                    }}
                  />
                </div>
                {plain && (
                  <HomebrewRulesText
                    label={`${label} rules text`}
                    text={paragraphsOf(row.entries)}
                    onText={(text) => replace(index, { entries: entriesOf(text) })}
                  />
                )}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => write([...list, { name: "" }])}
          className={`self-start ${ROW_BUTTON}`}
        >
          Add a {noun}
        </button>
        {error && (
          <p role="alert" className="text-error text-row">
            {error}
          </p>
        )}
      </fieldset>
    );
  };
}

export const MonsterTraits = monsterTextBlocks({ key: "trait", noun: "trait", legend: "Traits" });
export const MonsterActions = monsterTextBlocks({
  key: "action",
  noun: "action",
  legend: "Actions",
});
export const MonsterReactions = monsterTextBlocks({
  key: "reaction",
  noun: "reaction",
  legend: "Reactions",
});
export const MonsterLegendaryActions = monsterTextBlocks({
  key: "legendary",
  noun: "legendary action",
  legend: "Legendary actions",
});

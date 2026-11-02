import type { HomebrewClassFeature } from "@dnd/catalog";
import { useRef } from "react";
import { isRecord } from "../../lib/entryGuards.ts";
import { InputField } from "../InputField.tsx";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { HomebrewRulesText } from "./HomebrewRulesText.tsx";
import {
  entriesOf,
  type HomebrewFormProps,
  paragraphsOf,
  typedInteger,
  withField,
} from "./homebrewEntry.ts";
import { ROW_BUTTON } from "./homebrewRows.ts";

/**
 * A homebrew class's features, one row each: the level it arrives at, its name and its rules
 * text. A row not yet given a level or a name is written as it stands, so the draft's problem
 * names it. Rows keep an id of their own for a key, so removing one leaves the rest's text.
 */
export function ClassFeatures({ entry, onChange, errorFor }: HomebrewFormProps) {
  const rows = entry.features ?? [];
  const shown = Array.isArray(rows) && rows.every((row) => isRecord(row) && !Array.isArray(row));
  const ids = useRef<number[]>([]);
  const next = useRef(0);
  const list = (shown ? rows : []) as Partial<HomebrewClassFeature>[];
  while (ids.current.length < list.length) ids.current.push(next.current++);
  const error = errorFor("features");
  if (!shown) {
    return (
      <div className="flex flex-col">
        <span className="mb-1 text-muted text-row">Features</span>
        <p className="text-muted text-row">
          This class states its features in a shape the form cannot show. Edit it in JSON.
        </p>
      </div>
    );
  }
  const write = (changed: Partial<HomebrewClassFeature>[]) =>
    onChange(withField(entry, "features", changed));
  const replace = (index: number, change: Partial<HomebrewClassFeature>) =>
    write(list.map((row, at) => (at === index ? { ...row, ...change } : row)));

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-1 font-semibold text-row">Class features</legend>
      <ul className="flex flex-col gap-3">
        {list.map((row, index) => {
          const label = `Feature ${index + 1}`;
          return (
            <li
              key={ids.current[index]}
              className="flex flex-col gap-2 rounded-control border border-border p-2"
            >
              <div className="flex items-end gap-2">
                <div className="w-24">
                  <InputField
                    label={`${label} level`}
                    type="number"
                    min={1}
                    max={20}
                    value={row.level ?? ""}
                    onChange={(event) =>
                      replace(index, { level: typedInteger(event.target.value) })
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <InputField
                    label={`${label} name`}
                    value={row.name ?? ""}
                    onChange={(event) => replace(index, { name: event.target.value })}
                  />
                </div>
                <HomebrewRowRemove
                  name={row.name || label.toLowerCase()}
                  onRemove={() => {
                    ids.current.splice(index, 1);
                    write(list.filter((_, at) => at !== index));
                  }}
                />
              </div>
              <HomebrewRulesText
                label={`${label} rules text`}
                text={paragraphsOf(row.entries)}
                onText={(text) => replace(index, { entries: entriesOf(text) })}
              />
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => write([...list, { level: 1 }])}
        className={`self-start ${ROW_BUTTON}`}
      >
        Add a feature
      </button>
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
    </fieldset>
  );
}

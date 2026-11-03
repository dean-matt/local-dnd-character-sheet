import type { HomebrewClassResource } from "@dnd/catalog";
import { useRef } from "react";
import { isRecord } from "../../lib/entryGuards.ts";
import { FormField } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";
import { Select } from "../Select.tsx";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { type HomebrewFormProps, numberAt, typedInteger, withField } from "./homebrewEntry.ts";
import { ROW_BUTTON } from "./homebrewRows.ts";

const LEVELS = Array.from({ length: 20 }, (_, at) => at + 1);

const RESETS = [
  { value: "", label: "Not stated" },
  { value: "short-rest", label: "Short rest" },
  { value: "long-rest", label: "Long rest" },
  { value: "none", label: "Never" },
];

type Row = Partial<HomebrewClassResource>;

/** A table's 20 maximums, a level the row does not hold reading as none. */
const maximumsOf = (row: Row): (number | null)[] =>
  LEVELS.map((level) => numberAt(row.maximums?.[level - 1]) ?? null);

/**
 * A homebrew class's resource tables, one row each: its name, when it refreshes, and its
 * maximum at each of levels 1 to 20, where a level left empty stays none rather than copying
 * the one before. Rows keep an id of their own for a key, so removing one leaves the rest's text.
 */
export function ClassResources({ entry, onChange, errorFor }: HomebrewFormProps) {
  const rows = entry.resources ?? [];
  const shown = Array.isArray(rows) && rows.every((row) => isRecord(row) && !Array.isArray(row));
  const ids = useRef<number[]>([]);
  const next = useRef(0);
  const list = (shown ? rows : []) as Row[];
  while (ids.current.length < list.length) ids.current.push(next.current++);
  const error = errorFor("resources");
  if (!shown) {
    return (
      <div className="flex flex-col">
        <span className="mb-1 text-muted text-row">Resources</span>
        <p className="text-muted text-row">
          This class states its resources in a shape the form cannot show. Edit it in JSON.
        </p>
      </div>
    );
  }
  const write = (changed: Row[]) => onChange(withField(entry, "resources", changed));
  const replace = (index: number, change: Row) =>
    write(list.map((row, at) => (at === index ? { ...row, ...change } : row)));

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-1 font-semibold text-row">Class resources</legend>
      <ul className="flex flex-col gap-3">
        {list.map((row, index) => {
          const label = `Resource ${index + 1}`;
          const maximums = maximumsOf(row);
          return (
            <li
              key={ids.current[index]}
              className="flex flex-col gap-2 rounded-control border border-border p-2"
            >
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <InputField
                    label={`${label} name`}
                    value={row.name ?? ""}
                    onChange={(event) => replace(index, { name: event.target.value })}
                  />
                </div>
                <div className="w-40">
                  <FormField label={`${label} resets`}>
                    {(control) => (
                      <Select
                        {...control}
                        options={RESETS}
                        value={row.resets ?? ""}
                        onChange={(resets) =>
                          replace(index, {
                            resets: (resets || undefined) as HomebrewClassResource["resets"],
                          })
                        }
                      />
                    )}
                  </FormField>
                </div>
                <HomebrewRowRemove
                  name={row.name || label.toLowerCase()}
                  onRemove={() => {
                    ids.current.splice(index, 1);
                    write(list.filter((_, at) => at !== index));
                  }}
                />
              </div>
              <div className="grid grid-cols-5 gap-2 @2xl:grid-cols-10">
                {LEVELS.map((level) => (
                  <div key={level} className="flex flex-col">
                    <span aria-hidden className="text-label text-muted">
                      Level {level}
                    </span>
                    <InputField
                      label={`${label} level ${level} maximum`}
                      labelHidden
                      type="number"
                      min={0}
                      value={maximums[level - 1] ?? ""}
                      onChange={(event) =>
                        replace(index, {
                          maximums: maximums.map((held, at) =>
                            at === level - 1 ? (typedInteger(event.target.value) ?? null) : held,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => write([...list, { name: "", maximums: LEVELS.map(() => null) }])}
        className={`self-start ${ROW_BUTTON}`}
      >
        Add a resource
      </button>
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
    </fieldset>
  );
}

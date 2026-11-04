import { knownByLevel } from "@dnd/catalog";
import { useRef } from "react";
import { useSearchFeatureTypes } from "../../hooks/useSearchFeatureTypes.ts";
import { isRecord } from "../../lib/entryGuards.ts";
import { featureTypeLabel } from "../../lib/featureTypeLabel.ts";
import { FormField } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";
import { Select } from "../Select.tsx";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { type HomebrewFormProps, listAt, typedInteger, withField } from "./homebrewEntry.ts";
import { ROW_BUTTON } from "./homebrewRows.ts";

const KEY = "optionalfeatureProgression";

const LEVELS = Array.from({ length: 20 }, (_, at) => at + 1);

type Block = Record<string, unknown>;

const typeOf = (block: Block): string =>
  Array.isArray(block.featureType) && typeof block.featureType[0] === "string"
    ? block.featureType[0]
    : "";

/**
 * How many options of each feature type a homebrew class or subclass knows, one row a type:
 * the type, picked from those the catalog and homebrew use, and the running total at each of
 * levels 1 to 20. A progression keyed by the levels it changes at shows its count carried
 * forward, and an edit writes all 20.
 */
export function OptionalFeatureCounts({ entry, onChange, errorFor }: HomebrewFormProps) {
  const rows = listAt(entry, KEY);
  const shown =
    entry[KEY] === undefined || rows.every((row) => isRecord(row) && !Array.isArray(row));
  const ids = useRef<number[]>([]);
  const next = useRef(0);
  const { data: listed = [], isError } = useSearchFeatureTypes();
  const list = (shown ? rows : []) as Block[];
  while (ids.current.length < list.length) ids.current.push(next.current++);
  const error = errorFor(KEY);
  if (!shown) {
    return (
      <div className="flex flex-col">
        <span className="mb-1 text-muted text-row">Optional features</span>
        <p className="text-muted text-row">
          This entry states its option counts in a shape the form cannot show. Edit it in JSON.
        </p>
      </div>
    );
  }
  const write = (changed: Block[]) =>
    onChange(withField(entry, KEY, changed.length > 0 ? changed : undefined));
  const replace = (index: number, change: Block) =>
    write(list.map((row, at) => (at === index ? { ...row, ...change } : row)));
  const options = [
    { value: "", label: "Choose a type" },
    ...[...new Set([...listed, ...list.map(typeOf).filter(Boolean)])].map((type) => ({
      value: type,
      label: featureTypeLabel(type),
    })),
  ];

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-1 font-semibold text-row">Optional features</legend>
      <p className="text-muted text-row">
        The options of a type a character knows by each level, counting those taken earlier.
      </p>
      <ul className="flex flex-col gap-3">
        {list.map((row, index) => {
          const label = `Count ${index + 1}`;
          const type = typeOf(row);
          const known = knownByLevel(row.progression) ?? LEVELS.map(() => 0);
          return (
            <li
              key={ids.current[index]}
              className="flex flex-col gap-2 rounded-control border border-border p-2"
            >
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <FormField label={`${label} feature type`}>
                    {(control) => (
                      <Select
                        {...control}
                        options={options}
                        value={type}
                        onChange={(picked) =>
                          replace(index, { featureType: picked ? [picked] : [] })
                        }
                      />
                    )}
                  </FormField>
                </div>
                <HomebrewRowRemove
                  name={type ? featureTypeLabel(type) : label.toLowerCase()}
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
                      label={`${label} level ${level} known`}
                      labelHidden
                      type="number"
                      min={0}
                      value={known[level - 1] || ""}
                      onChange={(event) =>
                        replace(index, {
                          progression: known.map((held, at) =>
                            at === level - 1
                              ? Math.max(0, typedInteger(event.target.value) ?? 0)
                              : held,
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
        onClick={() => write([...list, { featureType: [], progression: LEVELS.map(() => 0) }])}
        className={`self-start ${ROW_BUTTON}`}
      >
        Add an option count
      </button>
      {isError && (
        <p role="alert" className="text-error text-row">
          The feature type list did not load; add a type in JSON.
        </p>
      )}
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
    </fieldset>
  );
}

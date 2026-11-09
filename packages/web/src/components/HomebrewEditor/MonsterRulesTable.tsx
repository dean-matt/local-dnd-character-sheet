import type { ReactNode } from "react";
import { InputField } from "../InputField.tsx";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { ROW_BUTTON } from "./homebrewRows.ts";
import { type TablePart, withoutColumn } from "./monsterShapes.ts";

export interface MonsterRulesTableProps {
  part: TablePart;
  /** The table's label, which each control's label starts with: `Traits 1 table 1`. */
  title: string;
  /** The table as a button names it: `table 1 of trait 1`. */
  of: string;
  onChange: (part: TablePart) => void;
  /** The button that removes the whole table. */
  removeButton: ReactNode;
}

/**
 * A table in a row's rules text: its caption, a label over each column and a grid of cells, with
 * columns and rows added and removed. The grid scrolls sideways where the columns outgrow it.
 */
export function MonsterRulesTable({
  part,
  title,
  of,
  onChange,
  removeButton,
}: MonsterRulesTableProps) {
  const columns = Math.max(1, part.labels.length);
  const grid = { gridTemplateColumns: `repeat(${columns}, minmax(8rem, 1fr)) 2rem` };
  const setLabel = (at: number, value: string) =>
    onChange({ ...part, labels: part.labels.map((each, i) => (i === at ? value : each)) });
  const setCell = (row: number, at: number, value: string) =>
    onChange({
      ...part,
      rows: part.rows.map((cells, r) =>
        r === row ? cells.map((each, i) => (i === at ? value : each)) : cells,
      ),
    });
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 border-border border-l-2 pl-2">
      <legend className="mb-1 text-muted text-row">{title}</legend>
      <InputField
        label={`${title} caption`}
        value={part.caption}
        onChange={(event) => onChange({ ...part, caption: event.target.value })}
      />
      <div className="overflow-x-auto">
        <div className="grid items-end gap-2" style={grid}>
          {part.labels.map((label, at) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a column has no id, and the table only grows or shrinks at a column the user picked.
            <div key={at} className="flex items-end gap-1">
              <div className="min-w-0 flex-1">
                <InputField
                  label={`${title} column ${at + 1} label`}
                  value={label}
                  onChange={(event) => setLabel(at, event.target.value)}
                />
              </div>
              <HomebrewRowRemove
                name={`column ${at + 1} of ${of}`}
                onRemove={() => onChange(withoutColumn(part, at))}
              />
            </div>
          ))}
          <span aria-hidden />
          {part.rows.map((cells, row) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a row has no id, and the table only grows or shrinks at a row the user picked.
            <div key={row} className="col-span-full grid items-end gap-2" style={grid}>
              {cells.map((cell, at) => (
                <InputField
                  // biome-ignore lint/suspicious/noArrayIndexKey: a cell has no id, and sits at its column.
                  key={at}
                  label={`${title} row ${row + 1} column ${at + 1}`}
                  labelHidden
                  value={cell}
                  onChange={(event) => setCell(row, at, event.target.value)}
                />
              ))}
              <HomebrewRowRemove
                name={`row ${row + 1} of ${of}`}
                onRemove={() => onChange({ ...part, rows: part.rows.filter((_, r) => r !== row) })}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label={`Add a column to ${of}`}
          onClick={() =>
            onChange({
              ...part,
              labels: [...part.labels, ""],
              rows: part.rows.map((cells) => [...cells, ""]),
            })
          }
          className={ROW_BUTTON}
        >
          Add a column
        </button>
        <button
          type="button"
          aria-label={`Add a row to ${of}`}
          onClick={() => onChange({ ...part, rows: [...part.rows, Array(columns).fill("")] })}
          className={ROW_BUTTON}
        >
          Add a row
        </button>
        {removeButton}
      </div>
    </fieldset>
  );
}

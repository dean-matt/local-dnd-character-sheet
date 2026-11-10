import { parseTags, renderText } from "@dnd/tags";
import { type ReactNode, useContext, useRef, useState } from "react";
import { useRollAndRecord } from "../../hooks/useRollAndRecord.ts";
import { rowFor, tableDie } from "../../lib/rollableTable.ts";
import { RulesText } from "../RulesText/RulesText.tsx";
import { RollingFor } from "../rollerContext.ts";

/**
 * A 5etools table. Where a character's sheet is open and the first column names a die, that
 * column's header is a button that rolls the die into the roll log, highlights the row the
 * total lands in and announces the row's text.
 */
export function RulesTable({
  caption,
  colLabels,
  rows,
  renderCell,
}: {
  caption: string | undefined;
  colLabels: readonly unknown[];
  rows: readonly unknown[];
  renderCell: (cell: unknown, key: string) => ReactNode;
}) {
  const characterId = useContext(RollingFor);
  const { roll, failed } = useRollAndRecord(characterId ?? "");
  const [rolledRow, setRolledRow] = useState<number>();
  const [announcement, setAnnouncement] = useState("");
  const body = useRef<HTMLTableSectionElement>(null);
  const die = characterId === null ? undefined : tableDie(colLabels[0]);

  function rollTable(notation: string) {
    roll(notation, caption ?? notation, "dice", ({ total }) => {
      const row = rowFor(rows, total);
      setRolledRow(row);
      const cells = [...(body.current?.rows[row]?.cells ?? [])].slice(1);
      const text = cells.map((cell) => cell.textContent?.trim()).join(" ");
      setAnnouncement(row === -1 ? `Rolled ${total}: no row` : `Rolled ${total}: ${text}`);
    });
  }

  function header(label: unknown, index: number): ReactNode {
    if (index === 0 && die !== undefined) {
      const display = renderText(parseTags(String(label)));
      return (
        <button
          type="button"
          onClick={() => rollTable(die)}
          aria-label={`Roll ${die} on ${caption ?? "the table"}`}
          className="cursor-pointer underline decoration-dotted underline-offset-2"
        >
          {display}
        </button>
      );
    }
    return typeof label === "string" ? <RulesText text={label} /> : null;
  }

  const table = (
    <table className="w-full border-collapse text-left">
      {caption && <caption className="font-semibold">{caption}</caption>}
      {colLabels.length > 0 && (
        <thead>
          <tr>
            {colLabels.map((label, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a catalog table's columns never reorder.
              <th key={`h${index}`} scope="col" className="border-border border-b px-2 py-1">
                {header(label, index)}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody ref={body}>
        {rows.map((row, rowIndex) => (
          <tr
            // biome-ignore lint/suspicious/noArrayIndexKey: a catalog table's rows never reorder.
            key={`r${rowIndex}`}
            aria-current={rowIndex === rolledRow ? "true" : undefined}
            className={rowIndex === rolledRow ? "bg-accent-tint font-semibold" : undefined}
          >
            {(Array.isArray(row) ? row : []).map((cell, cellIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a catalog table's cells never reorder.
              <td key={`r${rowIndex}-c${cellIndex}`} className="px-2 py-1">
                {renderCell(cell, `r${rowIndex}-c${cellIndex}`)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
  if (die === undefined) return table;
  return (
    <div>
      {table}
      <p role="status" className="empty:hidden">
        {announcement}
        {failed && <span className="text-error"> (not logged)</span>}
      </p>
    </div>
  );
}

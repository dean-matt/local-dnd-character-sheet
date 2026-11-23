import { refKey } from "@dnd/character";
import type { RowPicks } from "../lib/spellPicks.ts";
import { RowPickFields } from "./RowPickFields.tsx";

const rowKey = ({ row }: RowPicks) => `${row.grantor}|${refKey(row.ref)}`;

/** The fields of every row that offers picks apart from the class's. */
export function RowPickList({
  rows,
  ...props
}: { rows: readonly RowPicks[] } & Omit<Parameters<typeof RowPickFields>[0], "row">) {
  if (rows.length === 0) return null;
  return (
    <div className="grid gap-7 sm:grid-cols-2">
      {rows.map((row) => (
        <RowPickFields key={rowKey(row)} row={row} {...props} />
      ))}
    </div>
  );
}

import { Link } from "react-router";
import { Tag } from "../components/Tag.tsx";
import { type CatalogIndexRow, catalogRowPath } from "../lib/catalogIndexes.ts";

export interface CatalogIndexRowsProps {
  collection: string;
  rows: CatalogIndexRow[];
}

export function CatalogIndexRows({ collection, rows }: CatalogIndexRowsProps) {
  return (
    <ul className="flex flex-col gap-0.5">
      {rows.map((row) => (
        <li key={"id" in row ? `homebrew:${row.id}` : `${row.name}|${row.source}`}>
          <Link
            to={catalogRowPath(collection, row)}
            className="flex items-baseline gap-2 rounded-control px-2 py-1 text-body hover:bg-subtle"
          >
            <span>{row.name}</span>
            {"id" in row ? (
              <Tag>Homebrew</Tag>
            ) : (
              <span className="text-muted text-row">{row.source}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

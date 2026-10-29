import { type ReactNode, useMemo, useState } from "react";
import { InputField } from "../InputField.tsx";
import { ENTRIES_TEXT } from "./itemJsonSchema.ts";

/** Rules text the sheet reads nothing from, with the example an item gives. */
const DISPLAYED_ENTRIES = {
  key: "entries",
  text: ENTRIES_TEXT,
  description: (
    <>
      The rules text. It only displays, <code>{"{@tags}"}</code> included:{" "}
      <code>{"{@ability wis +1}"}</code> prints, where <code>{'"ability": {"wis": 1}'}</code> raises
      Wisdom.
    </>
  ),
};

interface FieldReferenceProps {
  /** The fields the sheet reads off a kind, each described, as a Zod object holds them. */
  schema: { shape: Record<string, { description?: string }> };
}

/**
 * Every field in `schema` by name, and the rules text where `schema` leaves it out, narrowed
 * by a search of names and descriptions.
 */
export function FieldReference({ schema }: FieldReferenceProps) {
  const fields = useMemo(() => {
    const described: { key: string; text: string; description: ReactNode }[] = Object.entries(
      schema.shape,
    ).map(([key, { description = "" }]) => ({ key, text: description, description }));
    if (!("entries" in schema.shape)) described.push(DISPLAYED_ENTRIES);
    return described.sort((a, b) => a.key.localeCompare(b.key));
  }, [schema]);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = fields.filter(
    ({ key, text }) =>
      needle === "" || key.toLowerCase().includes(needle) || text.toLowerCase().includes(needle),
  );
  return (
    <div className="flex flex-col gap-2 text-row">
      <InputField
        label="Search fields"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {shown.length === 0 ? (
        <p className="text-muted">No field matches “{query.trim()}”.</p>
      ) : (
        <dl className="flex flex-col gap-2">
          {shown.map(({ key, description }) => (
            <div key={key}>
              <dt className="font-mono">{key}</dt>
              <dd className="text-muted">{description}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

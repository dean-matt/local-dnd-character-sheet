import { appliedItemFieldsSchema } from "@dnd/catalog";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { InputField } from "../../components/InputField.tsx";

const ENTRIES_TEXT =
  'The rules text. It only displays, {@tags} included: {@ability wis +1} prints, where "ability": {"wis": 1} raises Wisdom.';

const ENTRIES: ReactNode = (
  <>
    The rules text. It only displays, <code>{"{@tags}"}</code> included:{" "}
    <code>{"{@ability wis +1}"}</code> prints, where <code>{'"ability": {"wis": 1}'}</code> raises
    Wisdom.
  </>
);

/** Each field with the text a search reads and what the list prints. */
const FIELDS: { key: string; text: string; description: ReactNode }[] = [
  ...Object.entries(appliedItemFieldsSchema.shape).map(([key, schema]) => ({
    key,
    text: schema.description ?? "",
    description: schema.description,
  })),
  { key: "entries", text: ENTRIES_TEXT, description: ENTRIES },
].sort((a, b) => a.key.localeCompare(b.key));

/**
 * Every field the sheet reads off a homebrew item, and its rules text, by name, narrowed by a
 * search of names and descriptions. Collapsed, it marks itself `data-collapsed` so the JSON
 * beside it can take the width.
 */
export function ItemFieldReference() {
  const id = useId();
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = FIELDS.filter(
    ({ key, text }) =>
      needle === "" || key.toLowerCase().includes(needle) || text.toLowerCase().includes(needle),
  );
  return (
    <section
      aria-labelledby={`${id}-heading`}
      data-collapsed={open ? undefined : ""}
      className="flex flex-col gap-2 text-row"
    >
      <h3 id={`${id}-heading`} className="font-semibold">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 rounded-control hover:text-accent"
        >
          <ChevronDown
            aria-hidden
            size={14}
            className={open ? "transition-transform" : "-rotate-90 transition-transform"}
          />
          Field Reference
        </button>
      </h3>
      <div id={`${id}-body`} hidden={!open} className="flex flex-col gap-2">
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
    </section>
  );
}

import { appliedItemFieldsSchema } from "@dnd/catalog";
import { type ReactNode, useId } from "react";

const ENTRIES: ReactNode = (
  <>
    The rules text. It only displays, <code>{"{@tags}"}</code> included:{" "}
    <code>{"{@ability wis +1}"}</code> prints, where <code>{'"ability": {"wis": 1}'}</code> raises
    Wisdom.
  </>
);

const FIELDS: { key: string; description: ReactNode }[] = [
  ...Object.entries(appliedItemFieldsSchema.shape).map(([key, schema]) => ({
    key,
    description: schema.description,
  })),
  { key: "entries", description: ENTRIES },
].sort((a, b) => a.key.localeCompare(b.key));

/** The fields the sheet reads off a homebrew item, and its rules text, by name. */
export function ItemFieldReference() {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2 text-row">
      <h3 id={id} className="font-semibold">
        Field Reference
      </h3>
      <p className="text-muted">
        A bonus or a defense applies while the item is equipped, and attuned where it requires
        attunement. A field not listed here, such as a bonus to one skill or an action the item
        grants, only displays.
      </p>
      <dl className="flex flex-col gap-2">
        {FIELDS.map(({ key, description }) => (
          <div key={key}>
            <dt className="font-mono">{key}</dt>
            <dd className="text-muted">{description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

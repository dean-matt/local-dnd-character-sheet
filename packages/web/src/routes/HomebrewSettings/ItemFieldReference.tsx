import { appliedItemFieldsSchema } from "@dnd/catalog";

const FIELDS = Object.entries(appliedItemFieldsSchema.shape).map(([key, schema]) => ({
  key,
  description: schema.description,
}));

/** The fields the sheet reads off a homebrew item, collapsed until asked for. */
export function ItemFieldReference() {
  return (
    <details className="rounded-control border border-border bg-surface px-3 py-2 text-row">
      <summary className="cursor-pointer font-semibold">Fields the sheet reads</summary>
      <div className="mt-2 flex flex-col gap-2">
        <p className="text-muted">
          Rules text only displays, <code>{"{@tags}"}</code> included:{" "}
          <code>{"{@ability wis +1}"}</code> prints, and <code>{'"ability": {"wis": 1}'}</code>{" "}
          raises Wisdom. Set the fields below to change the sheet; the JSON view takes every one. A
          bonus or a defense applies while the item is equipped, and attuned where it requires
          attunement. Anything else, such as a bonus to one skill or an action the item grants, only
          displays.
        </p>
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1">
          {FIELDS.map(({ key, description }) => (
            <div key={key} className="contents">
              <dt className="font-mono">{key}</dt>
              <dd className="text-muted">{description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}

/**
 * `items.json`, `items-base.json` and `magicvariants.json` into the Tier A
 * `items` table.
 *
 * Three files and four array keys, because a `{@item}` tag reaches all four and
 * none of their `(name, source)` keys collides with another. `kind` records
 * which array an entry came from, so a picker offering equipment can leave out
 * the two that are not equipment.
 *
 * A magic variant states the item's own fields under `inherits` — the entry
 * around it is the template's match rules — so that is where the source, the
 * rarity and the attunement come from. The items upstream builds by applying a
 * template to a base item are not written here; see docs/items.md.
 */
import { EDITION_FILES, type Edition, editionOf, editions, ownFiles } from "./edition.ts";
import type { Loader, Row } from "./index.ts";
import { type Entry, entriesOf, isRecord, text } from "./json.ts";

type FromSource = (source: string) => Edition;

/** The array keys each file carries, which are the kinds it contributes. */
const KINDS: Record<string, string[]> = {
  "data/items.json": ["item", "itemGroup"],
  "data/items-base.json": ["baseitem"],
  "data/magicvariants.json": ["magicvariant"],
};

const VARIANT = "magicvariant";

/** Where an entry keeps the fields that describe the item, rather than the template. */
function itemFields(entry: Entry, kind: string, context: string): Entry {
  if (kind !== VARIANT) return entry;
  const inherits = entry.inherits;
  if (!isRecord(inherits)) throw new Error(`${context}: inherits is missing or not an object`);
  return inherits;
}

/**
 * A field upstream leaves out on some entries and writes as null on others —
 * 944 items carry no `type` and 43 no `rarity`. Present but not a string is a
 * shape change rather than an absence, so it is refused.
 */
function optionalText(entry: Entry, key: string, context: string): string | undefined {
  const value = entry[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value === "") {
    throw new Error(`${context}: ${key} is neither absent nor a string`);
  }
  return value;
}

/**
 * Whether attuning is required. `reqAttune` is `true` 601 times and a condition
 * such as `by a spellcaster` 250 more, both of which require it. The 11
 * `optional` items work unattuned and so do not.
 */
function requiresAttunement(fields: Entry, context: string): number {
  const required = fields.reqAttune;
  if (required === undefined || required === false || required === "optional") return 0;
  if (required === true || typeof required === "string") return 1;
  throw new Error(
    `${context}: reqAttune ${JSON.stringify(required)} is neither a flag nor a condition`,
  );
}

function toRow(entry: Entry, kind: string, context: string, fromSource: FromSource): Row {
  const fields = itemFields(entry, kind, context);
  const source = text(fields, "source", context);
  return {
    name: text(entry, "name", context),
    source,
    edition: editionOf(entry, source, fromSource),
    kind,
    type: optionalText(fields, "type", context),
    rarity: optionalText(fields, "rarity", context),
    requires_attunement: requiresAttunement(fields, context),
    json: JSON.stringify(entry),
  };
}

export const items: Loader = {
  name: "items",
  files: [...Object.keys(KINDS), ...EDITION_FILES],
  rows: (sources) => {
    const fromSource = editions(sources);
    return {
      items: ownFiles(sources).flatMap(([path, parsed]) => {
        const kinds = KINDS[path];
        if (kinds === undefined) throw new Error(`${path} belongs to no kind`);
        return kinds.flatMap((kind) =>
          entriesOf(parsed, kind, path).map((entry, index) =>
            toRow(entry, kind, `${path} ${kind}[${index}]`, fromSource),
          ),
        );
      }),
    };
  },
};

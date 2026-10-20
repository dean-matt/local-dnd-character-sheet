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
import { collectFluff, fluffKey, isFluffPath, withFluff } from "./fluff.ts";
import type { Loader, Row } from "./index.ts";
import { expandItemEntries, type ItemEntryTemplates, itemEntryTemplates } from "./item-entry.ts";
import { type Entry, entriesOf, isRecord, kindedRows, text } from "./json.ts";

type FromSource = (source: string) => Edition;

/** The array keys each file carries, the kinds it contributes. */
const KINDS: Record<string, string[]> = {
  "data/items.json": ["item", "itemGroup"],
  "data/items-base.json": ["baseitem"],
  "data/magicvariants.json": ["magicvariant"],
};

const ITEMS_FLUFF_FILE = "data/fluff-items.json";

const VARIANT = "magicvariant";

/**
 * Where an entry keeps the fields that describe the item, rather than the
 * template. An edition is the one field read off the entry itself either way,
 * so an `inherits` that grew one would be filed under the template's ruleset
 * instead — a wrong row that no CHECK can catch. None of the 214 carries one
 * today, and the 50 that declare an edition do it outside, so it is refused
 * rather than merged into a precedence this loader would then have to state.
 */
function itemFields(entry: Entry, kind: string, context: string): Entry {
  if (kind !== VARIANT) return entry;
  const inherits = entry.inherits;
  if (!isRecord(inherits)) throw new Error(`${context}: inherits is missing or not an object`);
  if (inherits.edition !== undefined) {
    throw new Error(`${context}: inherits declares an edition, which is read off the variant`);
  }
  return inherits;
}

/**
 * A field upstream leaves out on some entries and writes as null on others —
 * 944 items carry no `type` and 43 no `rarity`. Present but not a string is a
 * shape change rather than an absence, so it is refused; so is the empty
 * string, which reads as a value everywhere a NULL would not.
 */
function optionalText(entry: Entry, key: string, context: string): string | undefined {
  const value = entry[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error(`${context}: ${key} is not a string`);
  if (value === "") throw new Error(`${context}: ${key} is empty`);
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

const REPLICATION = ["classFeatures", "optionalfeatures"] as const;

/**
 * What an Artificer replicates each member of an item group with, keyed `name|source`.
 * Upstream writes the back-references on the group alone, so the members would otherwise
 * never state them.
 */
function groupReplication(files: [string, unknown][]): Map<string, Entry> {
  const groups = files
    .filter(([path]) => KINDS[path]?.includes("itemGroup"))
    .flatMap(([path, parsed]) => entriesOf(parsed, "itemGroup", path));
  return new Map(
    groups.flatMap((group) => {
      const carried = Object.fromEntries(
        REPLICATION.filter((key) => Array.isArray(group[key])).map((key) => [key, group[key]]),
      );
      const members = Array.isArray(group.items) ? group.items : [];
      return members.map((member): [string, Entry] => [String(member), carried]);
    }),
  );
}

/** The group's replication fields the member's own entry leaves out, so a stated one wins. */
function withGroupReplication(
  entry: Entry,
  kind: string,
  context: string,
  groups: Map<string, Entry>,
): Entry {
  const fields = itemFields(entry, kind, context);
  const inherited = groups.get(
    `${text(entry, "name", context)}|${text(fields, "source", context)}`,
  );
  if (inherited === undefined) return entry;
  const missing = Object.fromEntries(
    Object.entries(inherited).filter(([key]) => !Array.isArray(fields[key])),
  );
  return kind === VARIANT
    ? { ...entry, inherits: { ...fields, ...missing } }
    : { ...entry, ...missing };
}

function withExpanded(entry: Entry, fields: Entry, templates: ItemEntryTemplates): Entry {
  if (entry.entries === undefined) return entry;
  return { ...entry, entries: expandItemEntries(entry.entries, fields, templates) };
}

function withExpandedInherits(entry: Entry, fields: Entry, templates: ItemEntryTemplates): Entry {
  return { ...entry, inherits: withExpanded(fields, fields, templates) };
}

function toRow(
  listed: Entry,
  kind: string,
  context: string,
  fromSource: FromSource,
  fluff: (key: string) => Entry | undefined,
  templates: ItemEntryTemplates,
  groups: Map<string, Entry>,
): Row {
  const entry = withGroupReplication(listed, kind, context, groups);
  const fields = itemFields(entry, kind, context);
  const source = text(fields, "source", context);
  const withText = withFluff(entry, fluff(fluffKey(text(entry, "name", context), source)), context);
  const merged =
    kind === VARIANT
      ? withExpandedInherits(withText, fields, templates)
      : withExpanded(withText, fields, templates);
  return {
    name: text(entry, "name", context),
    source,
    edition: editionOf(entry, source, fromSource),
    kind,
    type: optionalText(fields, "type", context),
    rarity: optionalText(fields, "rarity", context),
    requires_attunement: requiresAttunement(fields, context),
    json: JSON.stringify(merged),
  };
}

export const items: Loader = {
  name: "items",
  files: [...Object.keys(KINDS), ITEMS_FLUFF_FILE, ...EDITION_FILES],
  rows: (sources) => {
    const fromSource = editions(sources);
    const fluff = collectFluff(
      [[ITEMS_FLUFF_FILE, sources.get(ITEMS_FLUFF_FILE)]],
      "itemFluff",
      (entry, ctx) => fluffKey(text(entry, "name", ctx), text(entry, "source", ctx)),
    );
    const files = ownFiles(sources).filter(([path]) => !isFluffPath(path));
    const templates = itemEntryTemplates(sources.get("data/items-base.json"));
    const groups = groupReplication(files);
    return {
      items: kindedRows(files, KINDS, (entry, kind, context) =>
        toRow(entry, kind, context, fromSource, fluff, templates, groups),
      ),
    };
  },
};

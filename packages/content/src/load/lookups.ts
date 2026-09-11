/**
 * The ten Tier B files into the one `lookups` table.
 *
 * `kind` is the array key the entry sits under upstream — `condition`,
 * `variantrule`, `deity` — which is also the `{@tag}` that links to it for every
 * kind that has one. Nothing here is queried by column, only resolved by key or
 * listed in a picker, so a row is its identity and the whole entry as `json`.
 *
 * Every lookup is doubled across the two editions — `skills.json` carries
 * Acrobatics once per ruleset — so a picker that does not filter on `edition`
 * shows each entry twice.
 */
import { EDITION_FILES, type Edition, editionOf, editions, ownFiles } from "./edition.ts";
import type { Loader, Row } from "./index.ts";
import { type Entry, kindedRows, text } from "./json.ts";

/** The array keys each file carries, which are the kinds it contributes. */
const KINDS: Record<string, string[]> = {
  "data/variantrules.json": ["variantrule"],
  "data/conditionsdiseases.json": ["condition", "disease", "status"],
  "data/skills.json": ["skill"],
  "data/senses.json": ["sense"],
  "data/languages.json": ["language", "languageScript"],
  "data/actions.json": ["action"],
  "data/tables.json": ["table"],
  "data/deities.json": ["deity"],
  "data/psionics.json": ["psionic"],
  "data/items-base.json": [
    "itemProperty",
    "itemType",
    "itemMastery",
    "itemEntry",
    "itemTypeAdditionalEntries",
  ],
};

/**
 * The field a kind spells its name with, where that field is not `name`.
 *
 * A property and a type are both linked by abbreviation — `{@itemProperty
 * 2H|XPHB}`, and `type` on an item reads `M|XPHB` — so the abbreviation is what
 * a reference resolves against. The one property carrying a `name` writes
 * `special`, the lowercase word an item's line renders, not a title, so taking
 * `name` where it exists would key one of the 26 differently from the rest.
 *
 * The human label an `itemType` also carries stays in `json`, which is where a
 * picker listing types reads it.
 */
const NAMED_BY: Record<string, string> = {
  itemProperty: "abbreviation",
  itemType: "abbreviation",
};

function toRow(
  kind: string,
  entry: Entry,
  context: string,
  fromSource: (source: string) => Edition,
): Row {
  const source = text(entry, "source", context);
  return {
    kind,
    name: text(entry, NAMED_BY[kind] ?? "name", context),
    source,
    qualifier: kind === "deity" ? text(entry, "pantheon", context) : "",
    edition: editionOf(entry, source, fromSource),
    json: JSON.stringify(entry),
  };
}

export const lookups: Loader = {
  name: "lookups",
  files: [...Object.keys(KINDS), ...EDITION_FILES],
  rows: (sources) => {
    const fromSource = editions(sources);
    return {
      lookups: kindedRows(ownFiles(sources), KINDS, (entry, kind, context) =>
        toRow(kind, entry, context, fromSource),
      ),
    };
  },
};

/**
 * The nine Tier B files into the one `lookups` table.
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
import { type Entry, isRecord, text } from "./json.ts";

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
};

function toRow(
  kind: string,
  entry: unknown,
  context: string,
  fromSource: (source: string) => Edition,
): Row {
  if (!isRecord(entry)) throw new Error(`${context} is not an object`);
  const source = text(entry, "source", context);
  return {
    kind,
    name: text(entry, "name", context),
    source,
    qualifier: kind === "deity" ? text(entry, "pantheon", context) : "",
    edition: editionOf(entry, source, fromSource),
    json: JSON.stringify(entry),
  };
}

function entriesOf(parsed: unknown, kind: string, path: string): Entry[] {
  const entries = isRecord(parsed) ? parsed[kind] : undefined;
  if (!Array.isArray(entries)) throw new Error(`${path} carries no ${kind} array`);
  return entries;
}

export const lookups: Loader = {
  name: "lookups",
  files: [...Object.keys(KINDS), ...EDITION_FILES],
  rows: (sources) => {
    const fromSource = editions(sources);
    return {
      lookups: ownFiles(sources).flatMap(([path, parsed]) => {
        const kinds = KINDS[path];
        if (kinds === undefined) throw new Error(`${path} belongs to no kind`);
        return kinds.flatMap((kind) =>
          entriesOf(parsed, kind, path).map((entry, index) =>
            toRow(kind, entry, `${path} ${kind}[${index}]`, fromSource),
          ),
        );
      }),
    };
  },
};

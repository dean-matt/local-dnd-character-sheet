/**
 * `backgrounds.json`, `feats.json` and `optionalfeatures.json` into their three
 * Tier A tables.
 *
 * One loader because the three are the same shape — identity, edition, and the
 * whole entry as `json` — and reading them together is one pass. Nothing here
 * is queried by column beyond a feature's type, which is a list upstream and so
 * lands in a table of its own.
 *
 * `races.json` is not here: it refuses to resolve at the pinned tag, and its
 * subraces have no table until it is decided where they belong. See the
 * `_versions` section of docs/5etools-data.md.
 */
import { EDITION_FILES, type Edition, editionOf, editions, ownFiles } from "./edition.ts";
import type { Loader, Row } from "./index.ts";
import { type Entry, isRecord, strings, text } from "./json.ts";

type FromSource = (source: string) => Edition;

/** The pool a class progression's `featureType` reaches, named for the loaders that borrow it. */
export const OPTIONAL_FEATURES_FILE = "data/optionalfeatures.json";

/** The array key each file carries, and the table its entries become. */
const FILES: Record<string, { key: string; table: string }> = {
  "data/backgrounds.json": { key: "background", table: "backgrounds" },
  "data/feats.json": { key: "feat", table: "feats" },
  [OPTIONAL_FEATURES_FILE]: { key: "optionalfeature", table: "optional_features" },
};

function entriesOf(parsed: unknown, key: string, path: string): Entry[] {
  const entries = isRecord(parsed) ? parsed[key] : undefined;
  if (!Array.isArray(entries)) throw new Error(`${path} carries no ${key} array`);
  return entries.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`${path} ${key}[${index}] is not an object`);
    return entry;
  });
}

function toRow(entry: Entry, context: string, fromSource: FromSource): Row {
  const source = text(entry, "source", context);
  return {
    name: text(entry, "name", context),
    source,
    edition: editionOf(entry, source, fromSource),
    json: JSON.stringify(entry),
  };
}

/** Every type a feature is offered under, as one row each. */
function typeRows(entry: Entry, row: Row, context: string): Row[] {
  return strings(entry, "featureType", context).map((type) => ({
    name: row.name,
    source: row.source,
    feature_type: type,
  }));
}

/**
 * Every type code the pool carries, for a loader that counts options by type and
 * cannot read the rows this one writes.
 *
 * Read from the same field `typeRows` reads, so a change to how a feature states
 * its types moves both together rather than leaving one checking the other
 * against a list it no longer builds.
 */
export function featureTypePool(sources: Map<string, unknown>): Set<string> {
  const path = OPTIONAL_FEATURES_FILE;
  const entries = entriesOf(sources.get(path), "optionalfeature", path);
  return new Set(
    entries.flatMap((entry, index) =>
      strings(entry, "featureType", `${path} optionalfeature[${index}]`),
    ),
  );
}

export const characterOptions: Loader = {
  name: "character-options",
  files: [...Object.keys(FILES), ...EDITION_FILES],
  rows: (sources) => {
    const fromSource = editions(sources);
    // Seeded from FILES, not by hand: a table named there and missed here would
    // take every one of its rows with it, and an absent table inserts nothing.
    const out: Record<string, Row[]> = { optional_feature_types: [] };
    for (const { table } of Object.values(FILES)) out[table] = [];

    for (const [path, parsed] of ownFiles(sources)) {
      const file = FILES[path];
      if (file === undefined) throw new Error(`${path} belongs to no table`);
      for (const [index, entry] of entriesOf(parsed, file.key, path).entries()) {
        const context = `${path} ${file.key}[${index}]`;
        const row = toRow(entry, context, fromSource);
        out[file.table]?.push(row);
        if (file.table === "optional_features") {
          out.optional_feature_types?.push(...typeRows(entry, row, context));
        }
      }
    }
    return out;
  },
};

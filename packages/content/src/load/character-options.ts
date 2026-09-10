/**
 * `backgrounds.json`, `feats.json` and `optionalfeatures.json` into their three
 * Tier A tables.
 *
 * One loader because the three are the same shape — identity, edition, and the
 * whole entry as `json` — and reading them together is one pass. Nothing here
 * is queried by column beyond a feature's type and the options it grants, both
 * of which are lists upstream and so land in tables of their own.
 */
import { EDITION_FILES, EDITIONS, type Edition, editionOf, editions, ownFiles } from "./edition.ts";
import type { Loader, Row } from "./index.ts";
import { type Entry, entriesOf, isRecord, strings, text } from "./json.ts";

type FromSource = (source: string) => Edition;

/** The pool a class progression's `featureType` reaches, named for the loaders that borrow it. */
export const OPTIONAL_FEATURES_FILE = "data/optionalfeatures.json";

/**
 * The array key each file carries, and the table its entries become. A table
 * named here is also a `granted_by` value, so adding one widens that column's
 * CHECK in `schema.ts` — a table this writes and that list omits fails the
 * rebuild naming neither the entry nor the column.
 */
const FILES: Record<string, { key: string; table: string }> = {
  "data/backgrounds.json": { key: "background", table: "backgrounds" },
  "data/feats.json": { key: "feat", table: "feats" },
  [OPTIONAL_FEATURES_FILE]: { key: "optionalfeature", table: "optional_features" },
};

function toRow(entry: Entry, source: string, edition: Edition, context: string): Row {
  return {
    name: text(entry, "name", context),
    source,
    edition,
    json: JSON.stringify(entry),
  };
}

/**
 * Every type code a feature is offered under. The rows below and the pool a
 * class-side count is checked against both read it here, so a feature stating
 * its types some other way moves the two together rather than leaving one
 * checking the other against a list it no longer builds.
 */
function featureTypes(entry: Entry, context: string): string[] {
  return strings(entry, "featureType", context);
}

/** Every type a feature is offered under, as one row each. */
function typeRows(entry: Entry, row: Row, context: string): Row[] {
  return featureTypes(entry, context).map((type) => ({
    name: row.name,
    source: row.source,
    feature_type: type,
  }));
}

/** A pool entry, as the edition a character plays and the code a count names. */
function poolKey(edition: Edition, featureType: string): string {
  return `${edition}|${featureType}`;
}

/** Whether any of the editions named offers an option of this type. */
function carriedBy(featureType: string, editions: Edition[], pool: Set<string>): boolean {
  return editions.some((edition) => pool.has(poolKey(edition, featureType)));
}

/**
 * Refuses a count of a type no optional feature of the counting entry's own
 * edition carries. Such a count entitles its holder to a pick over an empty
 * pool: the row says a level 7 warlock picks 6, the join returns 0 options, and
 * both halves are well formed. An upstream rename of a code is all it takes,
 * and nothing else reports it.
 *
 * Edition is half the key because the pick is edition-scoped — a sheet offers
 * the options of the edition the counting row itself belongs to, which is the
 * subclass's own where a subclass counts — so an entry counting a code only the
 * other edition's features carry has the same empty join. All 15 pairs the
 * corpus states resolve, the thinnest of them by 2 options.
 *
 * The invariant is one-directional. A pool code no count names is legitimate —
 * `RP` is Eberron house renown, four options granted by a story award rather
 * than by a class — so only the count side has to resolve.
 */
export function reachesPool(
  featureType: string,
  edition: Edition,
  pool: Set<string>,
  who: string,
  context: string,
): void {
  if (carriedBy(featureType, [edition], pool)) return;
  // Which edition, spelled out: "no one optional feature" reads as none at all,
  // and sending a reader after an upstream rename is the wrong hunt.
  throw new Error(
    `${context}: ${who} counts ${featureType}, which no optional feature of the ${edition} edition carries`,
  );
}

/** The key a progression carries where its entry has no level to file a count at. */
export const ANY_LEVEL = "*";

/** A cell of a progression, refused rather than coerced. */
export function optionCount(cell: unknown, context: string): number {
  if (typeof cell !== "number" || !Number.isInteger(cell) || cell < 0) {
    throw new Error(`${context}: ${JSON.stringify(cell)} is not a count of options`);
  }
  return cell;
}

/**
 * A grant reaches whatever pool its holder may pick from, and that is both
 * rulesets: a 2024 character may hold a 2014 feat, so the total the sheet asks
 * for joins the options unfiltered by edition. Only a code nothing carries at
 * all is a count over an empty join, which is the half a rebuild can refuse.
 *
 * The class side scopes its own check by edition, because a class row's pick is
 * scoped — a sheet offers the options of the counting row's own ruleset.
 */
function reachesGrantPool(
  featureType: string,
  pool: Set<string>,
  who: string,
  context: string,
): void {
  if (carriedBy(featureType, EDITIONS, pool)) return;
  throw new Error(`${context}: ${who} grants ${featureType}, which no optional feature carries`);
}

/**
 * The count a leveless entry grants, keyed `*` for "at any level" because a feat
 * reaches a character at whatever level they took it.
 *
 * The level-keyed forms a class states belong to the tables keyed by level, so
 * one here is refused rather than folded onto a level this row does not carry —
 * the mirror of the refusal `classes.ts` makes for `*`.
 */
function grantCount(progression: unknown, context: string): number {
  if (!isRecord(progression)) {
    throw new Error(
      `${context}: progression is not a map keyed ${JSON.stringify(ANY_LEVEL)} alone`,
    );
  }
  const keys = Object.keys(progression);
  if (keys.length !== 1 || keys[0] !== ANY_LEVEL) {
    throw new Error(
      `${context}: an entry with no level keys a progression ${JSON.stringify(ANY_LEVEL)} alone, not ${JSON.stringify(keys)}`,
    );
  }
  const known = optionCount(progression[ANY_LEVEL], context);
  if (known === 0) {
    throw new Error(`${context}: a grant of no options`);
  }
  return known;
}

/**
 * `optionalfeatureProgression` on a leveless entry, as a row per type granted.
 *
 * Superior Technique is the entry that shows why the grantor's table is a
 * column: it is a fighting style granting a maneuver, so this reads the same
 * field off an optional feature as off a feat.
 */
function grantRows(
  entry: Entry,
  row: Row,
  table: string,
  pool: Set<string>,
  context: string,
): Row[] {
  const blocks = entry.optionalfeatureProgression;
  if (blocks === undefined) return [];
  if (!Array.isArray(blocks)) {
    throw new Error(`${context}: optionalfeatureProgression is not a list`);
  }
  const rows = blocks.map((block, index) => {
    const where = `${context} optionalfeatureProgression[${index}]`;
    if (!isRecord(block)) throw new Error(`${where} is not an object`);
    const types = strings(block, "featureType", where);
    const [type] = types;
    if (types.length !== 1 || type === undefined) {
      throw new Error(
        `${where}: ${types.length} feature types share one count, and a row holds a count per type`,
      );
    }
    const who = `${String(row.name)}|${String(row.source)}`;
    reachesGrantPool(type, pool, who, where);
    return {
      granted_by: table,
      name: row.name,
      source: row.source,
      feature_type: type,
      known: grantCount(block.progression, where),
    };
  });
  // Two blocks granting one type collide on the primary key, which reaches the
  // build as a bare UNIQUE constraint naming neither the grantor nor the type.
  // They are also two counts that were meant to add up, and one row holds one.
  const seen = new Set<string>();
  for (const { feature_type: type } of rows) {
    if (seen.has(type)) {
      throw new Error(`${context}: two progressions grant ${type}, and one row holds one count`);
    }
    seen.add(type);
  }
  return rows;
}

/**
 * The pool a class-side count has to reach, for a loader that counts options by
 * type and cannot read the rows this one writes.
 *
 * Keyed by edition as well as by code, because the pick is: a sheet offers the
 * options of the counting row's own edition, so an entry counting a code only
 * the other edition's features carry has the same empty join as one counting a
 * code nothing carries at all.
 *
 * The caller passes its own `fromSource` rather than this reading `books.json`
 * again — a hidden second file to declare, and a second scan of the same map.
 */
export function featureTypePool(
  sources: Map<string, unknown>,
  fromSource: FromSource,
): Set<string> {
  const path = OPTIONAL_FEATURES_FILE;
  return new Set(
    entriesOf(sources.get(path), "optionalfeature", path).flatMap((entry, index) => {
      const context = `${path} optionalfeature[${index}]`;
      const edition = editionOf(entry, text(entry, "source", context), fromSource);
      return featureTypes(entry, context).map((type) => poolKey(edition, type));
    }),
  );
}

export const characterOptions: Loader = {
  name: "character-options",
  files: [...Object.keys(FILES), ...EDITION_FILES],
  rows: (sources) => {
    const fromSource = editions(sources);
    // Seeded from FILES, not by hand: a table named there and missed here would
    // take every one of its rows with it, and an absent table inserts nothing.
    const out: Record<string, Row[]> = {
      optional_feature_types: [],
      granted_optional_features: [],
    };
    for (const { table } of Object.values(FILES)) out[table] = [];
    const pool = featureTypePool(sources, fromSource);

    for (const [path, parsed] of ownFiles(sources)) {
      const file = FILES[path];
      if (file === undefined) throw new Error(`${path} belongs to no table`);
      for (const [index, entry] of entriesOf(parsed, file.key, path).entries()) {
        const context = `${path} ${file.key}[${index}]`;
        const source = text(entry, "source", context);
        const edition = editionOf(entry, source, fromSource);
        const row = toRow(entry, source, edition, context);
        out[file.table]?.push(row);
        if (file.table === "optional_features") {
          out.optional_feature_types?.push(...typeRows(entry, row, context));
        }
        out.granted_optional_features?.push(...grantRows(entry, row, file.table, pool, context));
      }
    }
    return out;
  },
};

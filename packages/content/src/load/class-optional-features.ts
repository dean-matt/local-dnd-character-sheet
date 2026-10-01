/**
 * An entry's `optionalfeatureProgression` into a row per level that may pick,
 * and the checks holding those counts to the table columns that print them
 * and to the pool of options carrying each type.
 */
import { ANY_LEVEL, optionCount, reachesPool } from "./character-options.ts";
import { display, LEVELS, type Owner, resourceKey } from "./class-table.ts";
import type { Edition } from "./edition.ts";
import type { Row } from "./index.ts";
import { type Entry, isRecord, strings } from "./json.ts";

function stated(cells: unknown[], context: string): number[] {
  if (cells.length !== LEVELS) {
    throw new Error(
      `${context}: ${cells.length} cells, and a progression covers all ${LEVELS} levels`,
    );
  }
  return cells.map((cell, index) => optionCount(cell, `${context} level ${index + 1}`));
}

/**
 * A `progression` keyed by the levels the count changes at, which says nothing
 * about the levels between: a sorcerer's `{"3":2,"10":3,"17":4}` knows two kinds
 * of metamagic at level 9, not none. Read as though it were stated, it files
 * every count at three levels and loses the other 15.
 */
function carried(progression: Entry, context: string): number[] {
  const changes = new Map<number, number>();
  for (const [key, cell] of Object.entries(progression)) {
    // Four feats and one optional feature key a progression `*`, for "at any
    // level", since neither has one. No class or subclass entry does, and these
    // tables are keyed by level, so it is named rather than read as a number.
    if (key === ANY_LEVEL) {
      throw new Error(
        `${context}: a progression keyed ${JSON.stringify(ANY_LEVEL)} has no level to file a count at`,
      );
    }
    // Exactly the 20 spellings, so no two keys reach one level and overwrite it:
    // Number would take "03", " 3" and "1e1" and land all three on a level.
    const level = /^(?:[1-9]|1\d|20)$/.test(key) ? Number(key) : Number.NaN;
    if (!Number.isInteger(level) || level < 1 || level > LEVELS) {
      throw new Error(`${context}: ${JSON.stringify(key)} is not a level from 1 to ${LEVELS}`);
    }
    changes.set(level, optionCount(cell, `${context} level ${level}`));
  }
  const counts: number[] = [];
  let held = 0;
  for (let level = 1; level <= LEVELS; level += 1) {
    held = changes.get(level) ?? held;
    counts.push(held);
  }
  return counts;
}

function progression(raw: unknown, context: string): number[] {
  if (Array.isArray(raw)) return stated(raw, context);
  if (isRecord(raw)) return carried(raw, context);
  throw new Error(`${context}: progression is neither a list of levels nor a map of them`);
}

/**
 * One block's rows: a level each, and a type each where a block names several.
 *
 * A block entitling no level to anything is upstream writing a progression and
 * saying nothing with it. Stored, it is a block that silently vanishes, so it is
 * refused the way a feature naming no class is.
 */
function blockRows(block: Entry, owner: Owner, where: string): Row[] {
  const counts = progression(block.progression, where);
  if (!counts.some((known) => known > 0)) {
    throw new Error(`${where}: a progression no level may pick from`);
  }
  const types = strings(block, "featureType", where);
  const [type] = types;
  if (types.length !== 1 || type === undefined) {
    throw new Error(
      `${where}: ${types.length} feature types share one count, and a row holds a count per type`,
    );
  }
  const rows: Row[] = [];
  for (const [at, known] of counts.entries()) {
    if (known > 0) rows.push({ ...owner, level: at + 1, feature_type: type, known });
  }
  return rows;
}

/**
 * Two blocks of one entry offering the same type collide on the primary key,
 * which reaches the build as a bare UNIQUE constraint naming neither the class
 * nor the type. They are also two counts that were meant to add up, and one row
 * holds one, so the refusal says that rather than the column that noticed.
 */
function oneCountEach(rows: Row[], context: string): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${String(row.feature_type)}|${String(row.level)}`;
    if (seen.has(key)) {
      throw new Error(
        `${context}: two progressions offer ${String(row.feature_type)} at level ${String(row.level)}, and one row holds one count`,
      );
    }
    seen.add(key);
  }
}

/**
 * `optionalfeatureProgression` into a row per level that may pick.
 *
 * A count absent from the sparse form is carried forward here rather than at
 * query time, so both forms leave the same rows and a reader needs neither.
 */
export function optionalFeatures(blocks: unknown, owner: Owner, context: string): Row[] {
  if (blocks === undefined) return [];
  if (!Array.isArray(blocks)) {
    throw new Error(`${context}: optionalfeatureProgression is not a list`);
  }
  const rows = blocks.flatMap((block, index) => {
    const where = `${context} optionalfeatureProgression[${index}]`;
    if (!isRecord(block)) throw new Error(`${where} is not an object`);
    return blockRows(block, owner, where);
  });
  oneCountEach(rows, context);
  return rows;
}

/** The type code a counted column names, ahead of anything else the tag carries. */
const FEATURE_TYPE = /\|feature type=([^|}]+)/;

/** Every one of the 13 `featureType` codes in the corpus is this shape. */
const PLAIN_CODE = /^[A-Z0-9:]+$/;

/**
 * A filter value is a small grammar: 265 tags in the corpus list values with `;`
 * or negate one with `!`, and it also brackets groups and pads with spaces. None
 * of that sits on a `feature type=` yet, and a column counting two types is a
 * count a row cannot divide, so anything but one plain code is refused by shape
 * rather than by listing the forms to reject. Matching the shape is what keeps
 * the refusal honest: a value this cannot read would otherwise fold to a bogus
 * code and be reported as a progression that does not offer it, sending a reader
 * to the wrong file.
 */
function plainCode(value: string, context: string): string {
  const code = value.toUpperCase();
  if (!PLAIN_CODE.test(code)) {
    throw new Error(
      `${context}: a column filters feature type ${JSON.stringify(value)}, and this reads one plain code`,
    );
  }
  return code;
}

/**
 * The columns that state a count `optionalfeatureProgression` states again, as
 * the code the column names paired with the key its label resolves to. The code
 * is in the tag `display` renders away, so pairing the two needs no hand-kept
 * map from type code to resource key — the list `edition.ts` warns goes stale
 * the day upstream ships a book.
 */
function countedColumns(groups: unknown, context: string): { code: string; key: string }[] {
  const labels = (Array.isArray(groups) ? groups : [])
    .filter(isRecord)
    .flatMap((group) => (Array.isArray(group.colLabels) ? group.colLabels : []));
  return labels.flatMap((raw: unknown) => {
    const code = typeof raw === "string" ? FEATURE_TYPE.exec(raw)?.[1] : undefined;
    if (code === undefined) return [];
    return [{ code: plainCode(code, context), key: resourceKey(display(raw, context)) }];
  });
}

/**
 * Refuses where the two tables holding one count disagree. They agree across the
 * corpus and nothing made them, so a newer tag that edits the column and not the
 * progression would ship a sheet printing a count the picker does not offer —
 * two well formed rows, and no query that reports the difference.
 *
 * A column counting a type the entry never offers is refused rather than passed
 * over: a skip is how this check would stop running without saying so.
 *
 * The pairing is entry-local, the ceiling: a class states the column and
 * a class states the progression, in all three pairs the corpus has. The two do
 * split across entries already — `Fighter|XPHB` carries no progression while
 * `Battle Master|XPHB` carries `MV:B` — so a tag that put a maneuver column on
 * the fighter's own table would be refused here rather than resolved against the
 * subclass. The way out is to collect the counted columns and the progressions
 * across an entry and its subclasses first and pair them after, as
 * `checkFeatureOwners` does for features; it is not worth the pass until a column
 * and its progression actually land on different entries.
 */
export function countsAgree(
  resources: Row[],
  typed: Row[],
  groups: unknown,
  context: string,
): void {
  const counted = countedColumns(groups, context);
  for (const { code, key } of counted) {
    const offered = typed.filter((row) => row.feature_type === code);
    if (offered.length === 0) {
      throw new Error(
        `${context}: a column counts ${code}, which no optionalfeatureProgression offers`,
      );
    }
    const known = new Map(offered.map((row) => [row.level, String(row.known)]));
    const printed = new Map(
      resources
        .filter((row) => row.resource_key === key)
        .map((row) => [row.level, String(row.value)]),
    );
    for (let level = 1; level <= LEVELS; level += 1) {
      const column = printed.get(level) ?? "0";
      const offers = known.get(level) ?? "0";
      if (column !== offers) {
        throw new Error(
          `${context} level ${level}: the ${key} column counts ${column} and ${code} offers ${offers}`,
        );
      }
    }
  }
}

/**
 * Every count an entry states has to reach the pool of options carrying its
 * type. The pool comes from `optionalfeatures.json` itself rather than from the
 * rows `character-options` writes out of it, since a loader cannot see what an
 * earlier one wrote.
 */
export function typesOffered(
  typed: Row[],
  who: string,
  edition: Edition,
  pool: Set<string>,
  context: string,
): void {
  for (const row of typed) reachesPool(String(row.feature_type), edition, pool, who, context);
}

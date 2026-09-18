/**
 * `data/spells/spells-*.json` into the Tier A `spells` table, and
 * `data/spells/sources.json` into `spell_classes`, the class list a picker
 * filters against.
 *
 * Spells are the clean case: no `_copy` to resolve and no `edition` field to
 * read, so a row is four columns lifted off the entry plus an edition resolved
 * from its source. Everything else stays in `json`, `{@tag}` markup untouched —
 * that is rendered at read time, not here.
 *
 * `sources.json`'s `class` and `classVariant` both contribute rows: 119 of 180
 * `classVariant` grants name no `class` entry for the same spell, so reading
 * only `class` would drop those spells from every class's list. The two carry
 * no distinct meaning to a query — a class either grants a spell or it doesn't
 * — so they collapse into one fact rather than two kinds. Upstream repeats a
 * handful of `classVariant` grants verbatim (`Booming Blade`'s Sorcerer,
 * Warlock and Wizard grants under `TCE`), so a `(spell, class)` pair already
 * seen is skipped rather than inserted twice.
 *
 * `subclass`, `feat`, `race` and `optionalfeature` keys do not exist in
 * `sources.json` at the pinned tag — every grantor is one of the nine base
 * classes that cast spells. What those four would name instead is a
 * filter-and-choose expression on `additionalSpells`, not a named spell, and
 * is a different mechanism than this table holds.
 */
import { CLASS_FILES, classIdentities } from "./classes.ts";
import { EDITION_FILES, type Edition, editions, ownFiles } from "./edition.ts";
import { collectFluff, fluffKey, isFluffPath, withFluff } from "./fluff.ts";
import type { Loader, Row } from "./index.ts";
import { type Entry, isRecord, text } from "./json.ts";

const SOURCES_FILE = "data/spells/sources.json";
const SPELLS_FLUFF = "data/spells/fluff-spells-*.json";

function toRow(
  entry: unknown,
  context: string,
  editionOf: (source: string) => Edition,
  fluff: (key: string) => Entry | undefined,
): Row {
  if (!isRecord(entry)) throw new Error(`${context} is not an object`);
  const source = text(entry, "source", context);
  const merged = withFluff(entry, fluff(fluffKey(text(entry, "name", context), source)), context);
  const level = entry.level;
  if (typeof level !== "number" || !Number.isInteger(level) || level < 0 || level > 9) {
    throw new Error(`${context}: level ${String(level)} is not a whole number from 0 to 9`);
  }
  const duration = entry.duration;
  if (!Array.isArray(duration) || duration.length === 0) {
    throw new Error(`${context}: duration is missing or not a list of spans`);
  }
  const meta = entry.meta;
  if (meta !== undefined && !isRecord(meta)) throw new Error(`${context}: meta is not an object`);
  return {
    name: text(entry, "name", context),
    source,
    edition: editionOf(source),
    level,
    school: text(entry, "school", context),
    concentration: duration.some((span) => isRecord(span) && span.concentration === true) ? 1 : 0,
    ritual: isRecord(meta) && meta.ritual === true ? 1 : 0,
    json: JSON.stringify(merged),
  };
}

function grantsOf(grants: Entry, kind: "class" | "classVariant", context: string): Entry[] {
  const list = grants[kind];
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new Error(`${context}.${kind} is not a list`);
  return list.map((grant, index) => {
    if (!isRecord(grant)) throw new Error(`${context}.${kind}[${index}] is not an object`);
    return grant;
  });
}

/** Every row one spell's grants contribute, `class` and `classVariant` alike. */
function grantRows(
  spellName: string,
  spellSource: string,
  grants: Entry,
  context: string,
  knownClasses: ReadonlySet<string>,
  seen: Set<string>,
): Row[] {
  const rows: Row[] = [];
  for (const kind of ["class", "classVariant"] as const) {
    for (const grant of grantsOf(grants, kind, context)) {
      const className = text(grant, "name", `${context}.${kind}`);
      const classSource = text(grant, "source", `${context}.${kind}`);
      const classKey = `${className}|${classSource}`;
      if (!knownClasses.has(classKey)) {
        throw new Error(`${context}.${kind} names class ${classKey}, which no row holds`);
      }
      const key = `${spellName}|${spellSource}|${classKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        spell_name: spellName,
        spell_source: spellSource,
        class_name: className,
        class_source: classSource,
      });
    }
  }
  return rows;
}

function spellClassRows(
  parsed: unknown,
  knownSpells: ReadonlySet<string>,
  knownClasses: ReadonlySet<string>,
): Row[] {
  if (!isRecord(parsed)) throw new Error(`${SOURCES_FILE} is not an object`);
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const [spellSource, bySpell] of Object.entries(parsed)) {
    if (!isRecord(bySpell)) throw new Error(`${SOURCES_FILE}.${spellSource} is not an object`);
    for (const [spellName, grants] of Object.entries(bySpell)) {
      const context = `${SOURCES_FILE}.${spellSource}.${spellName}`;
      if (!isRecord(grants)) throw new Error(`${context} is not an object`);
      if (!knownSpells.has(`${spellName}|${spellSource}`)) {
        throw new Error(`${context} names a spell no spells row holds`);
      }
      rows.push(...grantRows(spellName, spellSource, grants, context, knownClasses, seen));
    }
  }
  return rows;
}

export const spells: Loader = {
  name: "spells",
  files: ["data/spells/spells-*.json", SPELLS_FLUFF, SOURCES_FILE, CLASS_FILES, ...EDITION_FILES],
  rows: (sources) => {
    const editionOf = editions(sources);
    const fluffFiles = [...sources].filter(([path]) => isFluffPath(path));
    const fluff = collectFluff(fluffFiles, "spellFluff", (entry, ctx) =>
      fluffKey(text(entry, "name", ctx), text(entry, "source", ctx)),
    );
    const spellFiles = ownFiles(sources).filter(
      ([path]) => path !== SOURCES_FILE && !path.startsWith("data/class/") && !isFluffPath(path),
    );
    const spellRows = spellFiles.flatMap(([path, source]) => {
      if (!isRecord(source) || !Array.isArray(source.spell)) {
        throw new Error(`${path} carries no spell array`);
      }
      return source.spell.map((entry, index) =>
        toRow(entry, `${path}[${index}]`, editionOf, fluff),
      );
    });
    const knownSpells = new Set(
      spellRows.map((row) => `${String(row.name)}|${String(row.source)}`),
    );
    const knownClasses = classIdentities(sources);
    return {
      spells: spellRows,
      spell_classes: spellClassRows(sources.get(SOURCES_FILE), knownSpells, knownClasses),
    };
  },
};

/**
 * The class, subclass and feature rows a class file's entries build, and the
 * checks that hold each row to an owner some other row holds.
 */
import { countsAgree, optionalFeatures, typesOffered } from "./class-optional-features.ts";
import { tableGroups } from "./class-table.ts";
import { type Edition, editionOf } from "./edition.ts";
import { fluffKey, withFluff } from "./fluff.ts";
import type { Row } from "./index.ts";
import { type Entry, isRecord, text } from "./json.ts";

/** Every class but the three sidekicks carries `hd`, and none rolls more than one. */
function hitDie(entry: Entry, context: string): number {
  const hd = entry.hd;
  if (!isRecord(hd)) throw new Error(`${context}: hd is missing or not an object`);
  const { number, faces } = hd;
  if (number !== 1) {
    throw new Error(`${context}: hd rolls ${String(number)} dice, and hit_die holds one`);
  }
  if (typeof faces !== "number" || !Number.isInteger(faces) || faces < 1) {
    throw new Error(`${context}: hd faces ${String(faces)} is not a positive whole number`);
  }
  return faces;
}
/**
 * A subclass table group repeats its owner in a `subclasses` list. Trusting the
 * owning entry instead would silently file another subclass's dice under this
 * one, so a group that names anything else is refused rather than guessed at.
 */
function ownsGroups(entry: Entry, name: string, source: string, context: string): void {
  for (const group of Array.isArray(entry.subclassTableGroups) ? entry.subclassTableGroups : []) {
    const listed = isRecord(group) && Array.isArray(group.subclasses) ? group.subclasses : [];
    const mine =
      listed.length === 1 &&
      isRecord(listed[0]) &&
      listed[0].name === name &&
      listed[0].source === source;
    if (!mine) {
      throw new Error(`${context}: a table group names ${JSON.stringify(listed)}, not its owner`);
    }
  }
}

export function entriesOf(source: unknown, key: string, path: string): Entry[] {
  if (!isRecord(source)) throw new Error(`${path} is not an object`);
  const entries = source[key];
  if (entries === undefined) return [];
  if (!Array.isArray(entries)) throw new Error(`${path} carries a ${key} that is not a list`);
  return entries.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`${path} ${key}[${index}] is not an object`);
    return entry;
  });
}

function featureLevel(entry: Entry, context: string): number {
  const { level } = entry;
  if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > 20) {
    throw new Error(`${context}: level ${String(level)} is not a whole number from 1 to 20`);
  }
  return level;
}

/**
 * A feature's identity is longer than any other Tier A row's, and is the same
 * set of parts its tag carries. `Ability Score Improvement` from `PHB` is 63
 * rows across twelve classes and five levels, so a key of name and source alone
 * resolves 62 of them to the wrong feature and reports nothing wrong.
 */
function classFeatureRow(
  entry: Entry,
  context: string,
  fromSource: (source: string) => Edition,
): Row {
  const source = text(entry, "source", context);
  return {
    name: text(entry, "name", context),
    source,
    class_name: text(entry, "className", context),
    class_source: text(entry, "classSource", context),
    level: featureLevel(entry, context),
    edition: editionOf(entry, source, fromSource),
    json: JSON.stringify(entry),
  };
}

function subclassFeatureRow(
  entry: Entry,
  context: string,
  fromSource: (source: string) => Edition,
): Row {
  return {
    ...classFeatureRow(entry, context, fromSource),
    subclass_short_name: text(entry, "subclassShortName", context),
    subclass_source: text(entry, "subclassSource", context),
  };
}

export type Tables = {
  classes: Row[];
  subclasses: Row[];
  class_resources: Row[];
  spell_slots: Row[];
  subclass_resources: Row[];
  subclass_spell_slots: Row[];
  class_optional_features: Row[];
  subclass_optional_features: Row[];
  class_features: Row[];
  subclass_features: Row[];
};

type FromSource = (source: string) => Edition;

export function addClasses(
  out: Tables,
  source: unknown,
  path: string,
  fromSource: FromSource,
  pool: Set<string>,
  fluff: (key: string) => Entry | undefined,
): void {
  for (const [index, entry] of entriesOf(source, "class", path).entries()) {
    // The three sidekicks are stat-block companions rather than player classes:
    // they carry no hit die, proficiencies or table groups, upstream
    // saying the same thing three ways.
    if (entry.isSidekick === true) continue;
    const context = `${path} class[${index}]`;
    if (entry.subclassTableGroups !== undefined) {
      throw new Error(`${context}: a class entry carries subclassTableGroups`);
    }
    const name = text(entry, "name", context);
    const classSource = text(entry, "source", context);
    const edition = editionOf(entry, classSource, fromSource);
    const merged = withFluff(entry, fluff(fluffKey(name, classSource)), context);
    out.classes.push({
      name,
      source: classSource,
      edition,
      hit_die: hitDie(entry, context),
      json: JSON.stringify(merged),
    });
    const owner = { class_name: name, class_source: classSource };
    const { resources, slots } = tableGroups(entry.classTableGroups, owner, context);
    const typed = optionalFeatures(entry.optionalfeatureProgression, owner, context);
    countsAgree(resources, typed, entry.classTableGroups, context);
    typesOffered(typed, `${name}|${classSource}`, edition, pool, context);
    out.class_resources.push(...resources);
    out.spell_slots.push(...slots);
    out.class_optional_features.push(...typed);
  }
}

export function addSubclasses(
  out: Tables,
  source: unknown,
  path: string,
  fromSource: FromSource,
  pool: Set<string>,
  fluff: (key: string) => Entry | undefined,
): void {
  for (const [index, entry] of entriesOf(source, "subclass", path).entries()) {
    const context = `${path} subclass[${index}]`;
    const name = text(entry, "name", context);
    const subclassSource = text(entry, "source", context);
    const owner = {
      class_name: text(entry, "className", context),
      class_source: text(entry, "classSource", context),
      subclass_name: name,
      subclass_source: subclassSource,
    };
    ownsGroups(entry, name, subclassSource, context);
    const edition = editionOf(entry, subclassSource, fromSource);
    // Keyed without `classSource`: one subclass reaches both a class's classic
    // and remade printings, and upstream writes its lore once. Path of the
    // Totem Warrior's fluff names no `classSource`, so a key that included one
    // would miss both rows.
    const found = fluff(fluffKey(name, subclassSource, owner.class_name));
    const merged = withFluff(entry, found, context);
    out.subclasses.push({
      name,
      source: subclassSource,
      short_name: text(entry, "shortName", context),
      class_name: owner.class_name,
      class_source: owner.class_source,
      edition,
      json: JSON.stringify(merged),
    });
    const { resources, slots } = tableGroups(entry.subclassTableGroups, owner, context);
    const typed = optionalFeatures(entry.optionalfeatureProgression, owner, context);
    countsAgree(resources, typed, entry.subclassTableGroups, context);
    typesOffered(typed, `${name}|${subclassSource}`, edition, pool, context);
    out.subclass_resources.push(...resources);
    out.subclass_spell_slots.push(...slots);
    out.subclass_optional_features.push(...typed);
  }
}

/**
 * A sidekick's class is skipped, so its 47 features are skipped too rather than
 * left naming a class no row holds.
 */
export function addFeatures(
  out: Tables,
  claims: Map<Row, string>,
  source: unknown,
  path: string,
  fromSource: FromSource,
  sidekicks: Set<string>,
): void {
  const keep = (row: Row, into: Row[], context: string) => {
    if (sidekicks.has(classKey(row))) return;
    into.push(row);
    claims.set(row, context);
  };
  for (const [index, entry] of entriesOf(source, "classFeature", path).entries()) {
    const context = `${path} classFeature[${index}]`;
    keep(classFeatureRow(entry, context, fromSource), out.class_features, context);
  }
  for (const [index, entry] of entriesOf(source, "subclassFeature", path).entries()) {
    const context = `${path} subclassFeature[${index}]`;
    keep(subclassFeatureRow(entry, context, fromSource), out.subclass_features, context);
  }
}

/** The class a row names, as the key the class and feature tables agree on. */
function classKey(row: Row): string {
  return `${String(row.class_name)}|${String(row.class_source)}`;
}

/**
 * A feature naming a class no row holds loads fine and is then invisible: every
 * query for that class comes back without it. The sidekick skip is one known
 * case, so the rest are refused rather than assumed absent.
 *
 * Runs once every file is read, since a feature need not arrive with its class,
 * which is why the entry it came from is carried here rather than named again.
 */
export function checkFeatureOwners(out: Tables, claims: Map<Row, string>): void {
  const known = new Set(out.classes.map((row) => `${String(row.name)}|${String(row.source)}`));
  for (const [row, context] of claims) {
    if (!known.has(classKey(row))) {
      throw new Error(
        `${context}: ${String(row.name)} names class ${classKey(row)}, which no row holds`,
      );
    }
  }
}

/** Read before any row is built: a feature need not share a file with its class. */
export function sidekickClasses(files: [string, unknown][]): Set<string> {
  const sidekicks = new Set<string>();
  for (const [path, source] of files) {
    for (const [index, entry] of entriesOf(source, "class", path).entries()) {
      if (entry.isSidekick !== true) continue;
      const context = `${path} class[${index}]`;
      sidekicks.add(`${text(entry, "name", context)}|${text(entry, "source", context)}`);
    }
  }
  return sidekicks;
}

/**
 * `additionalSpells` on classes, subclasses, races, subraces, backgrounds, feats
 * and optional features into `spell_grants`: every spell each of them may give
 * a character.
 *
 * A grant names a spell outright — `"misty step|xphb"` — or states a filter
 * over the catalog, `{ "choose": "level=0|class=Wizard", "count": 2 }`. Both
 * resolve here, against the spells this loader reads, so a query asking which
 * feats can grant Fireball is an equality join. The pick a `choose` leaves to
 * the player is character state and stays out of `content.db`.
 *
 * A filter is clauses joined by `|`, each `key=value;value`: a spell passes
 * when every clause holds one of its values. Six keys appear at the pinned tag;
 * a seventh fails the build rather than matching nothing.
 *
 * A row records the level its reading arrives at: the grantor's lowest level
 * that gives the spell outright, or, for a pick, the lowest that offers it. A
 * key naming no level, such as `_` or the spell level `s1`, arrives with the
 * grantor and records 0. Whether a grant is innate, known, prepared or only
 * added to a class list, and how many a `choose` takes, stay in the grantor's
 * `json`.
 */
import { BACKGROUNDS_FILE, OPTIONAL_FEATURES_FILE } from "./character-options.ts";
import { entriesOf as classEntriesOf } from "./class-rows.ts";
import { CLASS_FILES, classIdentities } from "./classes.ts";
import type { Loader, Row } from "./index.ts";
import { type Entry, entriesOf, isRecord, text } from "./json.ts";
import { races, subraceName } from "./races.ts";
import { SOURCES_FILE, SPELL_FILES, spellClassRows } from "./spells.ts";

const FEATS_FILE = "data/feats.json";
const RACES_FILE = "data/races.json";
const KINDS = new Set(["innate", "known", "prepared", "expanded"]);

/** Block keys that describe a grant rather than hold spells. */
const DESCRIBING = new Set(["ability", "name", "resourceName"]);

/** 5etools reads a spell named without a source as the 2014 Player's Handbook's. */
const DEFAULT_SOURCE = "phb";

type Spell = {
  name: string;
  source: string;
  level: number;
  school: string;
  ritual: boolean;
  attacks: string[];
  classes: Set<string>;
};

type Catalog = { spells: Spell[]; byKey: Map<string, Spell> };

type Grantor = {
  granted_by: string;
  name: string;
  source: string;
  parent_name: string;
  parent_source: string;
  entry: Entry;
  context: string;
};

const fold = (value: string): string => value.trim().toLowerCase();

const spellKey = (name: string, source: string): string => `${fold(name)}|${fold(source)}`;

/** Each key's test, given the clause's values folded to lowercase. */
const CLAUSES: Record<string, (values: string[], where: string) => (spell: Spell) => boolean> = {
  level: (values, where) => {
    const levels = new Set(
      values.map((value) => {
        if (!/^\d$/.test(value)) throw new Error(`${where}: spell level ${value} is not 0 to 9`);
        return Number(value);
      }),
    );
    return (spell) => levels.has(spell.level);
  },
  class: (values) => (spell) => values.some((value) => spell.classes.has(value)),
  school: (values) => (spell) => values.includes(fold(spell.school)),
  source: (values) => (spell) => values.includes(fold(spell.source)),
  "components & miscellaneous": (values, where) => {
    if (values.some((value) => value !== "ritual")) {
      throw new Error(`${where}: only ritual is read under components & miscellaneous`);
    }
    return (spell) => spell.ritual;
  },
  "spell attack": (values) => (spell) =>
    spell.attacks.some((attack) => values.includes(fold(attack))),
};

function spellFilter(expression: string, where: string): (spell: Spell) => boolean {
  // The 2014 Bard's Magical Secrets writes its 18th-level pick, any spell at all, as "".
  if (expression === "") return () => true;
  const tests = expression.split("|").map((clause) => {
    const at = clause.indexOf("=");
    const key = fold(clause.slice(0, at));
    const test = CLAUSES[key];
    if (at === -1 || test === undefined) {
      throw new Error(`${where}: filter ${JSON.stringify(expression)} has no rule for ${clause}`);
    }
    return test(
      clause
        .slice(at + 1)
        .split(";")
        .map(fold),
      where,
    );
  });
  return (spell) => tests.every((test) => test(spell));
}

function catalogOf(sources: Map<string, unknown>): Catalog {
  const spells: Spell[] = [];
  for (const [path, parsed] of sources) {
    if (!path.startsWith("data/spells/spells-")) continue;
    for (const [index, entry] of entriesOf(parsed, "spell", path).entries()) {
      const context = `${path} spell[${index}]`;
      const { level, meta, spellAttack } = entry;
      if (typeof level !== "number") throw new Error(`${context}: level is not a number`);
      spells.push({
        name: text(entry, "name", context),
        source: text(entry, "source", context),
        level,
        school: text(entry, "school", context),
        ritual: isRecord(meta) && meta.ritual === true,
        attacks: Array.isArray(spellAttack) ? spellAttack.map(String) : [],
        classes: new Set(),
      });
    }
  }
  const byKey = new Map(spells.map((spell) => [spellKey(spell.name, spell.source), spell]));
  const classRows = spellClassRows(
    sources.get(SOURCES_FILE),
    new Set(spells.map((spell) => `${spell.name}|${spell.source}`)),
    classIdentities(sources),
  );
  for (const row of classRows) {
    byKey
      .get(spellKey(String(row.spell_name), String(row.spell_source)))
      ?.classes.add(fold(String(row.class_name)));
  }
  return { spells, byKey };
}

type Add = (
  granted_by: string,
  entry: Entry,
  context: string,
  parent?: [name: string, source: string],
) => void;

function addClassGrantors(sources: Map<string, unknown>, add: Add) {
  const classes = classIdentities(sources);
  for (const [path, parsed] of sources) {
    if (!path.startsWith("data/class/")) continue;
    for (const [index, entry] of classEntriesOf(parsed, "class", path).entries()) {
      const context = `${path} class[${index}]`;
      const key = `${text(entry, "name", context)}|${text(entry, "source", context)}`;
      if (classes.has(key)) add("classes", entry, context);
    }
    for (const [index, entry] of classEntriesOf(parsed, "subclass", path).entries()) {
      const context = `${path} subclass[${index}]`;
      add("subclasses", entry, context, [
        text(entry, "className", context),
        text(entry, "classSource", context),
      ]);
    }
  }
}

function grantorsOf(sources: Map<string, unknown>): Grantor[] {
  const grantors: Grantor[] = [];
  const add: Add = (granted_by, entry, context, parent = ["", ""]) => {
    grantors.push({
      granted_by,
      name: granted_by === "subraces" ? subraceName(entry, context) : text(entry, "name", context),
      source: text(entry, "source", context),
      parent_name: parent[0],
      parent_source: parent[1],
      entry,
      context,
    });
  };
  addClassGrantors(sources, add);
  const files: [string, string, string][] = [
    [BACKGROUNDS_FILE, "background", "backgrounds"],
    [FEATS_FILE, "feat", "feats"],
    [OPTIONAL_FEATURES_FILE, "optionalfeature", "optional_features"],
    [RACES_FILE, "race", "races"],
  ];
  for (const [path, key, table] of files) {
    for (const [index, entry] of entriesOf(sources.get(path), key, path).entries()) {
      add(table, entry, `${path} ${key}[${index}]`);
    }
  }
  for (const [index, entry] of entriesOf(
    sources.get(RACES_FILE),
    "subrace",
    RACES_FILE,
  ).entries()) {
    const context = `${RACES_FILE} subrace[${index}]`;
    add("subraces", entry, context, [
      text(entry, "raceName", context),
      text(entry, "raceSource", context),
    ]);
  }
  return grantors;
}

type Give = (spell: Spell, chosen: boolean) => void;

type Grant = { chosen: boolean; level: number };

/**
 * An outright grant wins over a pick; between two of the same kind, the lower level wins.
 * The ceiling: a spell offered at one level and given outright at a later one keeps only
 * the later, so below it the row reads as neither. A row per reading is the way out.
 */
function merged(held: Grant | undefined, next: Grant): Grant {
  if (held === undefined || (held.chosen && !next.chosen)) return next;
  if (held.chosen !== next.chosen) return held;
  return { chosen: held.chosen, level: Math.min(held.level, next.level) };
}

/** A block's top key as the level it arrives at, 0 for one naming no level. */
const arrival = (key: string): number => (/^\d+$/.test(key) ? Number(key) : 0);

function namedSpell(value: string, catalog: Catalog, where: string): Spell {
  const [name = "", source = ""] = (value.split("#")[0] ?? "").split("|");
  const spell = catalog.byKey.get(spellKey(name, source || DEFAULT_SOURCE));
  if (spell === undefined) throw new Error(`${where} names spell ${value}, which no row holds`);
  return spell;
}

/**
 * Walks a grant's nesting — level, then a frequency such as `daily`, then a use
 * count — down to its leaves: a named spell, a filter, or a `choose` from a list.
 */
function visit(value: unknown, chosen: boolean, where: string, catalog: Catalog, give: Give) {
  if (typeof value === "string") {
    give(namedSpell(value, catalog, where), chosen);
  } else if (Array.isArray(value)) {
    for (const item of value) visit(item, chosen, where, catalog, give);
  } else if (isRecord(value)) {
    visitRecord(value, chosen, where, catalog, give);
  } else {
    throw new Error(`${where}: ${JSON.stringify(value)} is not a grant`);
  }
}

function visitRecord(value: Entry, chosen: boolean, where: string, catalog: Catalog, give: Give) {
  const { all, choose } = value;
  if (typeof all === "string" || typeof choose === "string") {
    const test = spellFilter(String(all ?? choose), where);
    const pick = chosen || choose !== undefined;
    for (const spell of catalog.spells) if (test(spell)) give(spell, pick);
  } else if (isRecord(choose) && Array.isArray(choose.from)) {
    visit(choose.from, true, where, catalog, give);
  } else {
    for (const [key, inner] of Object.entries(value)) {
      visit(inner, chosen, `${where}.${key}`, catalog, give);
    }
  }
}

/** One `additionalSpells` block, each kind keyed by the level its spells arrive at. */
function visitBlock(
  block: unknown,
  alternative: boolean,
  where: string,
  catalog: Catalog,
  giveAt: (level: number) => Give,
) {
  if (!isRecord(block)) throw new Error(`${where} is not an object`);
  for (const [kind, byLevel] of Object.entries(block)) {
    if (DESCRIBING.has(kind)) continue;
    if (!KINDS.has(kind)) throw new Error(`${where} holds ${kind}, which no rule reads`);
    if (!isRecord(byLevel)) throw new Error(`${where}.${kind} is not keyed by level`);
    const chosen = alternative || kind === "expanded";
    for (const [key, value] of Object.entries(byLevel)) {
      visit(value, chosen, `${where}.${kind}.${key}`, catalog, giveAt(arrival(key)));
    }
  }
}

/**
 * Every spell one grantor may give, and whether the player picks it. A pick is
 * a `choose`, an `expanded` spell — added to a class list, still to be learned
 * or prepared — or anything in a grantor offering several `additionalSpells`
 * blocks, which upstream writes as alternatives: Magic Initiate's six classes.
 * A spell one grant gives outright and another offers is given outright.
 */
function grantsOf(grantor: Grantor, catalog: Catalog): Map<Spell, Grant> {
  const granted = new Map<Spell, Grant>();
  const blocks = grantor.entry.additionalSpells;
  // A `_versions` entry un-sets an inherited field with null: one Kobold version drops the
  // race's spells.
  if (blocks === undefined || blocks === null) return granted;
  if (!Array.isArray(blocks)) throw new Error(`${grantor.context}: additionalSpells is not a list`);
  const giveAt =
    (level: number): Give =>
    (spell, chosen) =>
      granted.set(spell, merged(granted.get(spell), { chosen, level }));
  for (const [index, block] of blocks.entries()) {
    const where = `${grantor.context} additionalSpells[${index}]`;
    visitBlock(block, blocks.length > 1, where, catalog, giveAt);
  }
  return granted;
}

export const spellGrants: Loader = {
  name: "spell grants",
  files: [
    SPELL_FILES,
    SOURCES_FILE,
    CLASS_FILES,
    BACKGROUNDS_FILE,
    FEATS_FILE,
    OPTIONAL_FEATURES_FILE,
    RACES_FILE,
  ],
  prepare: races.prepare,
  rows: (sources) => {
    const catalog = catalogOf(sources);
    const rows: Row[] = [];
    for (const grantor of grantorsOf(sources)) {
      const { entry: _entry, context: _context, ...identity } = grantor;
      for (const [spell, { chosen, level }] of grantsOf(grantor, catalog)) {
        rows.push({
          spell_name: spell.name,
          spell_source: spell.source,
          ...identity,
          chosen: chosen ? 1 : 0,
          level,
        });
      }
    }
    return { spell_grants: rows };
  },
};

/**
 * `additionalSpells` on subclasses, races, subraces, feats and optional
 * features into `spell_grants`: every spell each of them may give a character.
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
 * The ceiling: a row records whether a grantor can ever give a spell, not when
 * or how. The level a grant arrives at, whether it is innate, known, prepared
 * or only added to a class list, and how many a `choose` takes all stay in the
 * grantor's `json`. A picker reads them there until a query needs one as a
 * column here.
 */
import { OPTIONAL_FEATURES_FILE } from "./character-options.ts";
import { entriesOf as classEntriesOf } from "./class-rows.ts";
import { CLASS_FILES, classIdentities } from "./classes.ts";
import type { Loader, Row } from "./index.ts";
import { type Entry, entriesOf, isRecord, text } from "./json.ts";
import { races, subraceName } from "./races.ts";
import { SOURCES_FILE, SPELL_FILES, spellClassRows } from "./spells.ts";

const FEATS_FILE = "data/feats.json";
const RACES_FILE = "data/races.json";
const KINDS = ["innate", "known", "prepared", "expanded"] as const;

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

function spellsOf(sources: Map<string, unknown>): Spell[] {
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
  return spells;
}

function grantorsOf(sources: Map<string, unknown>): Grantor[] {
  const grantors: Grantor[] = [];
  const add = (
    granted_by: string,
    entry: Entry,
    context: string,
    parent: [name: string, source: string] = ["", ""],
  ) =>
    grantors.push({
      granted_by,
      name: granted_by === "subraces" ? subraceName(entry, context) : text(entry, "name", context),
      source: text(entry, "source", context),
      parent_name: parent[0],
      parent_source: parent[1],
      entry,
      context,
    });
  for (const [path, parsed] of sources) {
    if (path.startsWith("data/class/")) {
      for (const [index, entry] of classEntriesOf(parsed, "subclass", path).entries()) {
        const context = `${path} subclass[${index}]`;
        add("subclasses", entry, context, [
          text(entry, "className", context),
          text(entry, "classSource", context),
        ]);
      }
    }
  }
  const files: [string, string, string][] = [
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

type Catalog = { spells: Spell[]; byKey: Map<string, Spell> };
type Give = (spell: Spell, chosen: boolean) => void;

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

/**
 * Every spell one grantor may give, and whether the player picks it. A pick is
 * a `choose`, an `expanded` spell — added to a class list, still to be learned
 * or prepared — or anything in a grantor offering several `additionalSpells`
 * blocks, which upstream writes as alternatives: Magic Initiate's six classes.
 * A spell one grant gives outright and another offers is given outright.
 */
function grantsOf(grantor: Grantor, catalog: Catalog): Map<Spell, boolean> {
  const granted = new Map<Spell, boolean>();
  const blocks = grantor.entry.additionalSpells;
  // A `_versions` entry un-sets an inherited field with null: one Kobold version drops the
  // race's spells.
  if (blocks === undefined || blocks === null) return granted;
  if (!Array.isArray(blocks)) throw new Error(`${grantor.context}: additionalSpells is not a list`);
  const give: Give = (spell, chosen) => granted.set(spell, chosen && (granted.get(spell) ?? true));
  for (const [index, block] of blocks.entries()) {
    const where = `${grantor.context} additionalSpells[${index}]`;
    if (!isRecord(block)) throw new Error(`${where} is not an object`);
    for (const kind of KINDS) {
      if (block[kind] === undefined) continue;
      visit(
        block[kind],
        blocks.length > 1 || kind === "expanded",
        `${where}.${kind}`,
        catalog,
        give,
      );
    }
  }
  return granted;
}

export const spellGrants: Loader = {
  name: "spell grants",
  files: [SPELL_FILES, SOURCES_FILE, CLASS_FILES, FEATS_FILE, OPTIONAL_FEATURES_FILE, RACES_FILE],
  prepare: races.prepare,
  rows: (sources) => {
    const spells = spellsOf(sources);
    const catalog = {
      spells,
      byKey: new Map(spells.map((spell) => [spellKey(spell.name, spell.source), spell])),
    };
    const rows: Row[] = [];
    for (const grantor of grantorsOf(sources)) {
      const { entry: _entry, context: _context, ...identity } = grantor;
      for (const [spell, chosen] of grantsOf(grantor, catalog)) {
        rows.push({
          spell_name: spell.name,
          spell_source: spell.source,
          ...identity,
          chosen: chosen ? 1 : 0,
        });
      }
    }
    return { spell_grants: rows };
  },
};

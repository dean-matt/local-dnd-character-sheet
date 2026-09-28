/**
 * Checks every catalog reference one character holds against `content.db`, on demand.
 * A reference matches its row exactly, as the sheet's own readers match it, so what this
 * reports is what the sheet shows unresolved. A miss that upstream's redirect map sends to
 * a row of the same table carries that row as `renamedTo`; nothing is written back.
 */
import {
  type CatalogKind,
  type CatalogReference,
  type CharacterDefinition,
  type CharacterReferences,
  type CharacterState,
  catalogReferences,
} from "@dnd/character";
import type Database from "better-sqlite3";
import { openContentDb } from "../content.ts";
import { redirects } from "./refs.ts";

/**
 * `where` holds the key beyond `(name, source)`, bound after them. `page` is the namespace
 * `tag_redirects` files the kind under; a subclass, a subrace and a deity have no redirect
 * of their own.
 */
const KINDS: Record<CatalogKind, { from: string; where?: string; page?: string }> = {
  class: { from: "classes", page: "classes.html" },
  subclass: { from: "subclasses", where: "class_name = ? AND class_source = ?" },
  race: { from: "races", page: "races.html" },
  subrace: { from: "subraces", where: "race_name = ? AND race_source = ?" },
  background: { from: "backgrounds", page: "backgrounds.html" },
  skill: { from: "lookups", where: "kind = 'skill' AND qualifier = ''", page: "skill" },
  language: {
    from: "lookups",
    where: "kind = 'language' AND qualifier = ''",
    page: "languages.html",
  },
  item: { from: "items", page: "items.html" },
  spell: { from: "spells", page: "spells.html" },
  feat: { from: "feats", page: "feats.html" },
  optionalFeature: { from: "optional_features", page: "optionalfeatures.html" },
  deity: { from: "lookups", where: "kind = 'deity' AND qualifier = ?" },
  condition: {
    from: "lookups",
    where: "kind = 'condition' AND qualifier = ''",
    page: "conditionsdiseases.html",
  },
};

const select = (kind: CatalogKind, collate: string) => {
  const { from, where } = KINDS[kind];
  const key = `name = ?${collate} AND source = ?${collate}`;
  return `SELECT name, source FROM ${from} WHERE ${key}${where ? ` AND ${where}` : ""} LIMIT 1`;
};

type Found = { name: string; source: string } | undefined;

export function checkCharacterReferences(
  dataDir: string,
  definition: CharacterDefinition,
  state: CharacterState,
): CharacterReferences {
  const references = catalogReferences(definition, state);
  if (references.length === 0) return { unresolved: [] };
  const db = openContentDb(dataDir);
  try {
    const statements = new Map<string, Database.Statement>();
    const prepared = (sql: string) => {
      const statement = statements.get(sql) ?? db.prepare(sql);
      statements.set(sql, statement);
      return statement;
    };
    const hop = redirects(db);
    const resolves = ({ kind, ref, parent, pantheon }: CatalogReference) => {
      const rest = parent ? [parent.name, parent.source] : pantheon ? [pantheon] : [];
      return prepared(select(kind, "")).get(ref.name, ref.source, ...rest) !== undefined;
    };
    // Upstream lowercases a redirect's target, so only its row spells the name right.
    const renamedTo = ({ kind, ref }: CatalogReference): Found => {
      const { page } = KINDS[kind];
      const to = page === undefined ? undefined : hop(page, ref.name, ref.source);
      if (to === undefined || to.page !== page) return undefined;
      return prepared(select(kind, " COLLATE NOCASE")).get(to.name, to.source) as Found;
    };
    const unresolved = references
      .filter((reference) => !resolves(reference))
      .map((reference) => {
        const row = renamedTo(reference);
        return { ...reference, ...(row && { renamedTo: row }) };
      });
    return { unresolved };
  } finally {
    db.close();
  }
}

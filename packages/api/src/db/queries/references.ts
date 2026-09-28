/**
 * Checks every catalog reference one definition holds against `content.db`, on demand.
 * A reference matches its row exactly, as the sheet's own readers match it, so what this
 * reports is what the sheet shows unresolved. A miss that upstream's redirect map sends to
 * a row of the same table carries that row as `renamedTo`; nothing is written back.
 */
import {
  type CatalogKind,
  type CatalogReference,
  type CharacterDefinition,
  type CharacterReferences,
  type ContentRef,
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
};

const select = (kind: CatalogKind, collate: string) => {
  const { from, where } = KINDS[kind];
  const key = `name = ?${collate} AND source = ?${collate}`;
  return `SELECT name, source FROM ${from} WHERE ${key}${where ? ` AND ${where}` : ""} LIMIT 1`;
};

type Found = { name: string; source: string } | undefined;

/** The row a redirect of the same table names, as the row spells it: upstream lowercases a target. */
function renamedTo(db: Database.Database, kind: CatalogKind, ref: ContentRef): Found {
  const { page } = KINDS[kind];
  const to = page === undefined ? undefined : redirects(db)(page, ref.name, ref.source);
  if (to === undefined || to.page !== page) return undefined;
  return db.prepare(select(kind, " COLLATE NOCASE")).get(to.name, to.source) as Found;
}

export function checkCharacterReferences(
  dataDir: string,
  definition: CharacterDefinition,
): CharacterReferences {
  const references = catalogReferences(definition);
  if (references.length === 0) return { unresolved: [] };
  const db = openContentDb(dataDir);
  try {
    const exact = new Map<CatalogKind, Database.Statement>();
    const resolves = ({ kind, ref, parent, pantheon }: CatalogReference) => {
      const statement = exact.get(kind) ?? db.prepare(select(kind, ""));
      exact.set(kind, statement);
      const rest = parent ? [parent.name, parent.source] : pantheon ? [pantheon] : [];
      return statement.get(ref.name, ref.source, ...rest) !== undefined;
    };
    const unresolved = references
      .filter((reference) => !resolves(reference))
      .map((reference) => {
        const row = renamedTo(db, reference.kind, reference.ref);
        return { ...reference, ...(row && { renamedTo: row }) };
      });
    return { unresolved };
  } finally {
    db.close();
  }
}

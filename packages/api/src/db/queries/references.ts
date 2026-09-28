/**
 * Checks every catalog reference one character holds against `content.db`, on demand.
 * A reference matches its row exactly and a variant expands with its base, as the sheet's
 * own readers do, so what this reports is what the sheet shows unresolved. A miss that
 * upstream's redirect map sends to a row of the same table carries that row as
 * `renamedTo`; nothing is written back.
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
import { getExpandedItem } from "./item-variant.ts";
import { redirectPage, redirects } from "./refs.ts";

/**
 * `where` holds the key beyond `(name, source)`, bound after them. `tag` is the `{@tag}`
 * whose redirects the kind shares; a subclass, a subrace and a deity have none of their own.
 */
const KINDS: Record<CatalogKind, { from: string; where?: string; tag?: string }> = {
  class: { from: "classes", tag: "class" },
  subclass: { from: "subclasses", where: "class_name = ? AND class_source = ?" },
  race: { from: "races", tag: "race" },
  subrace: { from: "subraces", where: "race_name = ? AND race_source = ?" },
  background: { from: "backgrounds", tag: "background" },
  skill: { from: "lookups", where: "kind = 'skill' AND qualifier = ''", tag: "skill" },
  language: { from: "lookups", where: "kind = 'language' AND qualifier = ''", tag: "language" },
  item: { from: "items", tag: "item" },
  spell: { from: "spells", tag: "spell" },
  feat: { from: "feats", tag: "feat" },
  optionalFeature: { from: "optional_features", tag: "optfeature" },
  deity: { from: "lookups", where: "kind = 'deity' AND qualifier = ?" },
  condition: { from: "lookups", where: "kind = 'condition' AND qualifier = ''", tag: "condition" },
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
      // The sheet shows a variant only as the item it and its base expand into.
      // getExpandedItem opens content.db twice a call beside this handle: cheap at inventory
      // sizes, and a getItem that takes the open handle is the way out if it ever shows.
      if (kind === "item" && parent) return Boolean(getExpandedItem(dataDir, parent, ref));
      const rest = parent ? [parent.name, parent.source] : pantheon ? [pantheon] : [];
      return prepared(select(kind, "")).get(ref.name, ref.source, ...rest) !== undefined;
    };
    // Upstream lowercases a redirect's target, so only its row spells the name right. The
    // row must itself resolve where the reference stands: a variant's redirect to the other
    // edition is no fix for a base item that refuses both.
    const renamedTo = (reference: CatalogReference): Found => {
      const { kind, ref } = reference;
      const { tag } = KINDS[kind];
      const page = tag === undefined ? undefined : redirectPage(tag);
      const to = page === undefined ? undefined : hop(page, ref.name, ref.source);
      if (to === undefined || to.page !== page) return undefined;
      const row = prepared(select(kind, " COLLATE NOCASE")).get(to.name, to.source) as Found;
      return row && resolves({ ...reference, ref: row }) ? row : undefined;
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

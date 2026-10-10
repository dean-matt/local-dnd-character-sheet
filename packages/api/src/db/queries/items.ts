import type { Edition } from "@dnd/rules";
import { openContentDb } from "../content.ts";

export type ItemRow = {
  name: string;
  source: string;
  edition: Edition;
  kind: "item" | "itemGroup" | "baseitem" | "magicvariant";
  type: string | null;
  rarity: string | null;
  requires_attunement: 0 | 1;
  json: string;
};

const ITEM_COLUMNS = "name, source, edition, kind, type, rarity, requires_attunement, json";

/**
 * `item` and `baseitem` only — the two kinds a character can own. An `itemGroup` is the
 * entry a family of items is written under and a `magicvariant` is a template upstream
 * expands against a base item; see docs/items.md.
 */
export function listItems(dataDir: string, edition: Edition): ItemRow[] {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(
        `SELECT ${ITEM_COLUMNS} FROM items
         WHERE edition = ? AND kind IN ('item', 'baseitem')
         ORDER BY name, source`,
      )
      .all(edition) as ItemRow[];
  } finally {
    db.close();
  }
}

export function getItem(dataDir: string, name: string, source: string): ItemRow | undefined {
  const db = openContentDb(dataDir);
  try {
    return db
      .prepare(`SELECT ${ITEM_COLUMNS} FROM items WHERE name = ? AND source = ?`)
      .get(name, source) as ItemRow | undefined;
  } finally {
    db.close();
  }
}

/** Every row read over one connection, since a pack can list dozens. */
export function getItems(
  dataDir: string,
  refs: readonly { name: string; source: string }[],
): (ItemRow | undefined)[] {
  if (refs.length === 0) return [];
  const db = openContentDb(dataDir);
  try {
    const select = db.prepare(`SELECT ${ITEM_COLUMNS} FROM items WHERE name = ? AND source = ?`);
    return refs.map((ref) => select.get(ref.name, ref.source) as ItemRow | undefined);
  } finally {
    db.close();
  }
}

/**
 * The mastery each base item states, keyed by the uid as an item's `baseItem` writes it,
 * lowercase: `mace|xphb`. A uid naming no base item, or one that states no mastery, is absent.
 */
export function getBaseItemMasteries(
  dataDir: string,
  uids: readonly string[],
): Map<string, string[]> {
  const masteries = new Map<string, string[]>();
  if (uids.length === 0) return masteries;
  const db = openContentDb(dataDir);
  try {
    const select = db
      .prepare(
        `SELECT json_extract(json, '$.mastery') FROM items
         WHERE kind = 'baseitem' AND name = ? COLLATE NOCASE AND source = ? COLLATE NOCASE`,
      )
      .pluck();
    for (const uid of uids) {
      const [name = "", source = ""] = uid.split("|");
      const mastery = select.get(name, source) as string | undefined;
      if (mastery) masteries.set(uid, JSON.parse(mastery) as string[]);
    }
    return masteries;
  } finally {
    db.close();
  }
}

/**
 * Each item `type`'s label, keyed by the type as the item writes it. `HA|XPHB` reads the
 * XPHB row. A bare `HA` names the classic type, whose source varies by code — `G` sits
 * under PHB and `$A` under DMG — so it reads the classic row, and failing that the
 * alphabetically first source.
 */
export function getItemTypeNames(dataDir: string, types: readonly string[]): Map<string, string> {
  if (types.length === 0) return new Map();
  const db = openContentDb(dataDir);
  try {
    const select = db.prepare<[string, string], { label: string | null }>(
      `SELECT json_extract(json, '$.name') AS label FROM lookups
       WHERE kind = 'itemType' AND name = ?
       ORDER BY source = ? DESC, edition IS 'classic' DESC, source LIMIT 1`,
    );
    return new Map(
      types.flatMap((type) => {
        const [abbreviation = "", source = ""] = type.split("|");
        const label = select.get(abbreviation, source)?.label;
        return typeof label === "string" && label ? [[type, label]] : [];
      }),
    );
  } finally {
    db.close();
  }
}

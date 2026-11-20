import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FEATURE_COST_ENTRIES,
  FEATURE_MECHANICS,
  type FeatureCost,
  featureCost,
  featureCostRecorded,
} from "@dnd/character";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent, resolveContentDb } from "./build-db.ts";
import { characterOptions } from "./load/character-options.ts";
import { classes } from "./load/classes.ts";

const VENDOR = join(import.meta.dirname, "../../../vendor/5etools");

/** Each class, by `(name, source)`, that holds the feature at any level or through any subclass. */
const HOLDERS = `
  SELECT class_name, class_source FROM class_features WHERE name = ? AND source = ?
  UNION
  SELECT class_name, class_source FROM subclass_features WHERE name = ? AND source = ?`;

const CARRIES = `
  SELECT 1 FROM class_resources
   WHERE class_name = ? AND class_source = ? AND resource_key = ? LIMIT 1`;

type Holder = { class_name: string; class_source: string };

const GIVEN = new Set(
  FEATURE_MECHANICS.flatMap(({ mechanics = [] }) =>
    mechanics.flatMap((mechanic) => (mechanic.kind === "pool" ? [mechanic.key] : [])),
  ),
);

/**
 * Labels each pooled entry whose key no class holding its feature carries or has a recorded
 * pool give, and, for an optional feature no class holds, whose key no class table carries.
 */
function unresolved(db: Database.Database): string[] {
  const holders = db.prepare(HOLDERS);
  const carries = db.prepare(CARRIES);
  const anywhere = db.prepare("SELECT 1 FROM class_resources WHERE resource_key = ? LIMIT 1");
  return FEATURE_COST_ENTRIES.flatMap(({ ref, cost }) => {
    if (cost.pool === undefined) return [];
    const held = holders.all(ref.name, ref.source, ref.name, ref.source) as Holder[];
    const ok =
      GIVEN.has(cost.pool) ||
      (held.length === 0
        ? anywhere.get(cost.pool) !== undefined
        : held.some((c) => carries.get(c.class_name, c.class_source, cost.pool) !== undefined));
    return ok ? [] : [`${ref.name}|${ref.source} -> ${cost.pool}`];
  });
}

const CONSUMED = new Map<string, { pool?: string; feature?: string }>([
  ["Ki", { pool: "ki_points" }],
  ["Sorcery Point", { pool: "sorcery_points" }],
  ["Channel Divinity", { pool: "channel_divinity" }],
  ["Superiority Die", { pool: "superiority_dice" }],
  ["Psionic Energy Die", { feature: "Psionic Power" }],
]);

type Consumer = { name: string; source: string; json: string };

type Consumes = { name: string; amount?: number; amountMin?: number; amountMax?: number };

/** Whether the table's cost is the pool and the amounts the catalog states. */
function agrees(cost: FeatureCost, target: { pool?: string; feature?: string }, c: Consumes) {
  const spent = c.amount ?? c.amountMin ?? 1;
  const least = c.amountMin ?? spent;
  const most = c.amountMax ?? spent;
  const same = target.pool ? cost.pool === target.pool : cost.feature === target.feature;
  const within = cost.min <= least && most <= (cost.max ?? cost.min) && spent >= cost.min;
  return same && (within || cost.max === null);
}

/** Labels each PHB, XGE or TCE feature the catalog says consumes a pool that the table prices differently, or neither prices nor notes. */
function mispriced(db: Database.Database): string[] {
  const rows = ["class_features", "subclass_features", "optional_features"].flatMap(
    (table) =>
      db
        .prepare(
          `SELECT name, source, json FROM ${table}
            WHERE source IN ('PHB', 'XGE', 'TCE') AND json_extract(json, '$.consumes') IS NOT NULL`,
        )
        .all() as Consumer[],
  );
  return rows.flatMap(({ name, source, json }) => {
    const { consumes } = JSON.parse(json) as { consumes: Consumes };
    const target = CONSUMED.get(consumes.name);
    if (!target) return [];
    const cost = featureCost({ name, source });
    const label = `${name}|${source}`;
    if (!cost) return featureCostRecorded({ name, source }) ? [] : [`${label}: unpriced`];
    return agrees(cost, target, consumes) ? [] : [`${label}: ${JSON.stringify(cost)}`];
  });
}

describe.skipIf(!existsSync(join(VENDOR, "data/class")))(
  "the feature pools against vendor/",
  () => {
    let workspace = "";

    beforeEach(() => {
      workspace = mkdtempSync(join(tmpdir(), "content-pools-"));
    });

    afterEach(() => rmSync(workspace, { recursive: true, force: true }));

    it("name a resource key a class table or a recorded pool carries", () => {
      const contentDir = join(workspace, "data", "content");
      buildContent({
        vendorDir: VENDOR,
        contentDir,
        loaders: [classes, characterOptions],
        meta: {},
      });
      const db = new Database(resolveContentDb(contentDir), { readonly: true });
      try {
        expect(unresolved(db)).toEqual([]);
      } finally {
        db.close();
      }
    });

    it("price every feature the catalog says consumes a pool as the catalog does", () => {
      const contentDir = join(workspace, "data", "content");
      buildContent({
        vendorDir: VENDOR,
        contentDir,
        loaders: [classes, characterOptions],
        meta: {},
      });
      const db = new Database(resolveContentDb(contentDir), { readonly: true });
      try {
        expect(mispriced(db)).toEqual([]);
      } finally {
        db.close();
      }
    });
  },
);

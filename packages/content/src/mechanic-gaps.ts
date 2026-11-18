/**
 * The features in scope that record neither a mechanic nor the narrative mark, sorted by
 * the mechanic kinds their rules text suggests, and the committed count per kind that a
 * rise past fails. In scope is whatever the SRD 5.1 or 5.2 holds.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_MECHANICS, featureKey, type Mechanic, refKey } from "@dnd/character";
import type Database from "better-sqlite3";

type Kind = Mechanic["kind"];

/**
 * A keyword match over a feature's JSON, so it misses a mechanic worded otherwise and flags
 * a mention that grants nothing, and a feature matching no pattern goes unreported. Either
 * way, recording the feature — its mechanics or the narrative mark — takes it off the list.
 */
const KIND_PATTERNS: Record<Kind, RegExp> = {
  bonus: /\binitiative\b|hit point maximum increases/i,
  armorClass: /\bArmor Class\b|\bAC\b/,
  unarmoredBase: /(?:not wearing|without) (?:any )?armor/i,
  mediumArmorDexterity: /medium armor/i,
  proficiency: /\bproficiency (?:with|in)\b|Proficiencies":/i,
  pick: /\b(?:skills?|tools?|languages?) of your choice\b/i,
  halfProficiency: /half (?:of )?your proficiency bonus/i,
  sense: /\b(?:darkvision|blindsight|tremorsense|truesight)\b|"senses":/i,
  defense: /\bresistan(?:ce|t) to\b|\bimmun(?:e|ity) to\b|"(?:resist|immune|conditionImmune)":/i,
  speed: /\b(?:walking |climbing |swimming |flying )?speed (?:increases|of|equal)\b/i,
};

const KINDS = Object.keys(KIND_PATTERNS) as Kind[];

type Gaps = Record<Kind, string[]>;
export type Counts = Record<Kind, number>;

type FeatureRow = {
  name: string;
  source: string;
  json: string;
  class_name?: string;
  class_source?: string;
  subclass_short_name?: string;
  subclass_source?: string;
  level?: number;
};

const RECORDED = new Set(
  FEATURE_MECHANICS.map(({ ref }) => ("className" in ref ? featureKey(ref) : refKey(ref))),
);

function keyOf(row: FeatureRow): string {
  if (row.class_name === undefined || row.class_source === undefined || row.level === undefined)
    return refKey(row);
  return featureKey({
    name: row.name,
    source: row.source,
    className: row.class_name,
    classSource: row.class_source,
    level: row.level,
    ...(row.subclass_short_name !== undefined &&
      row.subclass_source !== undefined && {
        subclass: { shortName: row.subclass_short_name, source: row.subclass_source },
      }),
  });
}

function labelOf(row: FeatureRow): string {
  const subclass = row.subclass_short_name ? ` (${row.subclass_short_name})` : "";
  const owner = row.class_name ? `, ${row.class_name}${subclass} level ${row.level}` : "";
  return `${row.name} (${row.source})${owner}`;
}

const QUERIES = [
  "SELECT name, source, json, class_name, class_source, level FROM class_features",
  `SELECT name, source, json, class_name, class_source, subclass_short_name, subclass_source, level
     FROM subclass_features`,
  "SELECT name, source, json FROM feats",
  "SELECT name, source, json FROM optional_features",
];

function isGap(row: FeatureRow): boolean {
  const feature = JSON.parse(row.json) as { srd?: unknown; srd52?: unknown };
  return Boolean(feature.srd || feature.srd52) && !RECORDED.has(keyOf(row));
}

export function mechanicGaps(db: Database.Database): Gaps {
  const rows = QUERIES.flatMap((query) => db.prepare(query).all() as FeatureRow[]).filter(isGap);
  return Object.fromEntries(
    KINDS.map((kind) => [
      kind,
      rows
        .filter((row) => KIND_PATTERNS[kind].test(row.json))
        .map(labelOf)
        .sort(),
    ]),
  ) as Gaps;
}

const BASELINE_FILE = join(import.meta.dirname, "../mechanic-gaps.json");

export function countGaps(gaps: Gaps): Counts {
  return Object.fromEntries(KINDS.map((kind) => [kind, gaps[kind].length])) as Counts;
}

export function readBaseline(file = BASELINE_FILE): Partial<Counts> {
  return JSON.parse(readFileSync(file, "utf8")) as Partial<Counts>;
}

/** The kinds whose count rose past the baseline; a kind the baseline lacks starts at zero. */
export function risen(counts: Counts, baseline: Partial<Counts>): Kind[] {
  return KINDS.filter((kind) => counts[kind] > (baseline[kind] ?? 0));
}

/** Writes `counts` over the baseline where nothing rose and something fell. */
export function lowerBaseline(counts: Counts, file = BASELINE_FILE): boolean {
  const baseline = readBaseline(file);
  if (risen(counts, baseline).length > 0) return false;
  if (KINDS.every((kind) => counts[kind] === baseline[kind])) return false;
  writeFileSync(file, `${JSON.stringify(counts, null, 2)}\n`);
  return true;
}

export function reportGaps(gaps: Gaps, baseline: Partial<Counts>): string[] {
  const lines = ["Features in the SRD with no recorded mechanic or narrative mark, by kind:"];
  for (const kind of KINDS) {
    const was = baseline[kind] ?? 0;
    const mark = gaps[kind].length > was ? ` — up from ${was}` : "";
    lines.push(`  ${kind} ${gaps[kind].length}${mark}`);
    for (const label of gaps[kind]) lines.push(`    ${label}`);
  }
  return lines;
}

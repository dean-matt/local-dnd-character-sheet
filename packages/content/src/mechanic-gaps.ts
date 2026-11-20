/**
 * The features in scope that record neither a mechanic nor the narrative mark, sorted by
 * the mechanic kinds their rules text suggests, and the committed count per kind that a
 * rise past fails. In scope is every SRD 5.1 or 5.2 class feature, subclass feature, feat and
 * optional feature; race, subrace and background traits are not read.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  FEATURE_MECHANICS,
  featureKey,
  featurePoolKey,
  type Mechanic,
  refKey,
} from "@dnd/character";
import type Database from "better-sqlite3";

type Kind = Mechanic["kind"];

/**
 * A keyword match over a feature's JSON, so it misses a mechanic worded otherwise and flags
 * a mention that grants nothing; a feature matching no pattern is listed as `unclassified`.
 * Either way, recording the feature — its mechanics or the narrative mark — takes it off.
 * `uses` counts only a feature whose count the build read none of and no class pool holds.
 * `active` looks for a duration on the character's own benefit, so an effect the feature lays
 * on another creature is not one.
 * `convert` counts only a 2014 (`classic`) feature, since the 2024 ones wait on their own records.
 */
const KIND_PATTERNS: Record<Kind, RegExp> = {
  active:
    /\b(?:for|lasts? for) (?:the next )?(?:1|10|one) (?:minute|hour)s?\b[^.]{0,120}?\byou (?:have|gain|add|know|can sense)\b|\byou (?:have|gain|add|become|can sense)\b[^.]{0,60}?\bfor (?:1|10|one) (?:minute|hour)s?\b|\blasts? (?:for 10 minutes|until you dismiss)|\b(?:during that time|for the duration|until the end of your next turn), you (?:also )?(?:have|gain|know)\b|\bfor (?:1|10) (?:minute|hour)s?, you add\b|\bto gain [^.]{0,40}\bfor (?:1|10) (?:minute|hour)s?\b/i,
  heal: /\b(?:regain|restore)(?:s|ing)? [^."]{0,60}?\bhit points?\b/i,
  tempHp: /\btemporary hit points?\b/i,
  bonus: /\binitiative\b|hit point maximum increases/i,
  armorClass: /\bArmor Class\b|\bAC\b/,
  unarmoredBase: /\b(?:AC|Armor Class)(?:\|\w+\})? equals\b|\bcalculate your AC\b/,
  mediumArmorDexterity: /medium armor[^."]*\bDexterity\b/i,
  proficiency: /\bproficiency (?:with|in)\b|Proficiencies":/i,
  pick: /\b(?:skills?|tools?|languages?) of your choice\b/i,
  halfProficiency: /half (?:of )?your proficiency bonus/i,
  sense: /\b(?:darkvision|blindsight|tremorsense|truesight)\b|"senses":/i,
  defense: /\bresistan(?:ce|t) to\b|\bimmun(?:e|ity) to\b|"(?:resist|immune|conditionImmune)":/i,
  speed: /\b(?:walking |climbing |swimming |flying )?speed (?:increases|of|equal)\b/i,
  roll: /\b(?:advantage(?:\|XPHB\})? on|bonus to)[^."]{0,80}(?:saving throws?|checks?\b|\{@skill)|\badd [^."]{0,40}\bto (?:one|the|your|any) [^."]{0,30}\b(?:check|saving throw)|(?:saving throws?|checks?)[^."]{0,60}(?:gains? a bonus|reroll)|\breroll[^."]{0,40}(?:saving throw|check)/i,
  attack:
    /\bbonus to (?:\w+ ){0,2}(?:attack|damage) rolls\b|critical hit(?:\|XPHB\})? on a roll of|\badvantage(?:\|XPHB\})? on (?:melee weapon )?attack rolls\b|penalty to the attack roll/i,
  extraDamage:
    /\bextra (?:\{@damage [^}]+\} )?(?:[\w,]+ ){0,5}damage\b|\badditional weapon damage di(?:e|ce)\b/i,
  martialArts: /\bin place of the normal damage\b/i,
  pool: /\byou have (?:\w+ ){1,3}dice, which are\b/i,
  convert:
    /\b(?:transform|convert)\w*[^."]{0,60}\bspell slots?\b|\bspell slots?\b[^."]{0,60}\bto (?:gain|regain) [^."]{0,40}\b(?:points?|uses?)\b|\bregain one expended spell slot\b/i,
  turn: /\battack (?:\w+ ){0,3}(?:twice|three times|four times)\b|\bone additional action\b|\{@action (?!Attack)[^}]+\}[^."]{0,80}\bas a (?:\{@variantrule )?(?:bonus action|reaction)\b|\bas a (?:\{@variantrule )?bonus action\b[^."]{0,20}\{@action|\bbonus action on each of your turns in combat\b|\bgranted by your Cunning Action\b/i,
  spells:
    /"additionalSpells":|\byou (?:can|may) cast (?:the )?\{@spell [^}]+\}[^."]{0,40}\b(?:at will|once)\b|\bwithout expending a spell slot\b|\balways (?:have|has) (?!prepared)[^."]{1,80}\bprepared\b|\byou (?:learn|know) (?:the )?\{@spell [^}]+\} (?:cantrip|spell)\b|\bspells? of your choice from any\b/i,
  uses: /\bnumber of times equal to\b|\bregain (?:all |one |any )?(?:of )?(?:its |your )?expended uses\b|\buse (?:it|this feature) (?:again|twice|three times)\b|\b(?:can't|cannot) (?:use|do so|cast)[^."]{0,40} again until\b/i,
};

type Bucket = Kind | "unclassified";
const KINDS = Object.keys(KIND_PATTERNS) as Kind[];
const BUCKETS: Bucket[] = [...KINDS, "unclassified"];

type Gaps = Record<Bucket, string[]>;
export type Counts = Record<Bucket, number>;

type FeatureRow = {
  name: string;
  source: string;
  edition: string;
  json: string;
  class_name?: string;
  class_source?: string;
  subclass_short_name?: string;
  subclass_source?: string;
  level?: number;
  uses: number | null;
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
  "SELECT name, source, edition, json, uses, class_name, class_source, level FROM class_features",
  `SELECT name, source, edition, json, uses, class_name, class_source, subclass_short_name,
          subclass_source, level
     FROM subclass_features`,
  "SELECT name, source, edition, json, uses FROM feats",
  "SELECT name, source, edition, json, uses FROM optional_features",
];

function isGap(row: FeatureRow): boolean {
  const feature = JSON.parse(row.json) as { srd?: unknown; srd52?: unknown };
  return Boolean(feature.srd || feature.srd52) && !RECORDED.has(keyOf(row));
}

export function mechanicGaps(db: Database.Database): Gaps {
  const rows = QUERIES.flatMap((query) => db.prepare(query).all() as FeatureRow[]).filter(isGap);
  const suggests = (row: FeatureRow, kind: Kind) =>
    KIND_PATTERNS[kind].test(row.json) &&
    (kind !== "uses" || (row.uses === null && featurePoolKey(row) === undefined)) &&
    (kind !== "convert" || row.edition === "classic");
  const matches = (row: FeatureRow, bucket: Bucket) =>
    bucket === "unclassified" ? KINDS.every((kind) => !suggests(row, kind)) : suggests(row, bucket);
  return Object.fromEntries(
    BUCKETS.map((bucket) => [
      bucket,
      rows
        .filter((row) => matches(row, bucket))
        .map(labelOf)
        .sort(),
    ]),
  ) as Gaps;
}

const BASELINE_FILE = join(import.meta.dirname, "../mechanic-gaps.json");

export function countGaps(gaps: Gaps): Counts {
  return Object.fromEntries(BUCKETS.map((bucket) => [bucket, gaps[bucket].length])) as Counts;
}

export function readBaseline(file = BASELINE_FILE): Partial<Counts> {
  return JSON.parse(readFileSync(file, "utf8")) as Partial<Counts>;
}

/** The buckets whose count rose past the baseline; one the baseline lacks starts at zero. */
export function risen(counts: Counts, baseline: Partial<Counts>): Bucket[] {
  return BUCKETS.filter((bucket) => counts[bucket] > (baseline[bucket] ?? 0));
}

/** Writes `counts` over the baseline where nothing rose and something fell. */
export function lowerBaseline(counts: Counts, file = BASELINE_FILE): boolean {
  const baseline = readBaseline(file);
  if (risen(counts, baseline).length > 0) return false;
  if (BUCKETS.every((bucket) => counts[bucket] === baseline[bucket])) return false;
  writeFileSync(file, `${JSON.stringify(counts, null, 2)}\n`);
  return true;
}

export function reportGaps(gaps: Gaps, baseline: Partial<Counts>): string[] {
  const lines = ["Features in the SRD with no recorded mechanic or narrative mark, by kind:"];
  for (const bucket of BUCKETS) {
    const was = baseline[bucket] ?? 0;
    const mark = gaps[bucket].length > was ? ` — up from ${was}` : "";
    lines.push(`  ${bucket} ${gaps[bucket].length}${mark}`);
    for (const label of gaps[bucket]) lines.push(`    ${label}`);
  }
  return lines;
}

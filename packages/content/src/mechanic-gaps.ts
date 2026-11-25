/**
 * The features in scope that record neither a mechanic nor the narrative mark, sorted by
 * the mechanic kinds their rules text suggests, and the committed count per source and kind
 * that a rise past fails. In scope is every 2014 (`classic`) class feature, subclass feature,
 * feat, optional feature, race and subrace trait and background feature, and the SRD 5.2 ones
 * of the 2024 rules; a trait is one named entry of its race, subrace or background, and a
 * subrace holds only the traits it adds or changes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  FEATURE_MECHANICS,
  featureCostRecorded,
  featureKey,
  featurePoolKey,
  type Mechanic,
  refKey,
} from "@dnd/character";
import type Database from "better-sqlite3";

type Kind = Mechanic["kind"] | "poolCost" | "triggered";

/**
 * A keyword match over a feature's JSON, so it misses a mechanic worded otherwise and flags
 * a mention that grants nothing; a feature matching no pattern is listed as `unclassified`.
 * Either way, recording the feature — its mechanics or the narrative mark — takes it off.
 * `uses` counts only a feature whose count the build read none of and no class pool holds.
 * `active` looks for a duration on the character's own benefit, so an effect the feature lays
 * on another creature is not one.
 * `convert`, `slotRecovery` and `regain` count only a 2014 (`classic`) feature, since the 2024 ones wait on their own records.
 * `triggered` looks for an effect that waits on rolling initiative or on reducing or killing a creature, in a 2014 (`classic`) feature, since the 2024 ones wait on their own records.
 * `dc` looks for a save DC the text states from the character, so a fixed one is not one, in a
 * 2014 (`classic`) feature, since the 2024 ones wait on their own records.
 * `poolCost` counts a feature that names a cost from ki, sorcery points, Channel Divinity,
 * superiority dice or psionic energy dice and neither the cost table nor its notes list, in
 * a 2014 (`classic`) feature, since the 2024 ones wait on their own records.
 */
const KIND_PATTERNS: Record<Kind, RegExp> = {
  dc: /\{@dc 8\}(?:\|XPHB)? \+|\bagainst your (?:\w+ )?spell save DC|\bDC equals your (?:\w+ )?spell save DC|\bDC (?:equals|is) 8 \+|\bsave DC (?:is|equals) /i,
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
  slotRecovery:
    /\bchoose expended spell slots to recover\b|\brecover(?:s)? expended spell slots\b/i,
  regain:
    /\bregains? (?:\d+|all|one) (?:of )?(?:your )?expended (?:sorcery points?|(?:spell slots? from your )?Pact Magic|Psionic Energy di(?:e|ce))\b/i,
  turn: /\battack (?:\w+ ){0,3}(?:twice|three times|four times)\b|\bone additional action\b|\{@action (?!Attack)[^}]+\}[^."]{0,80}\bas a (?:\{@variantrule )?(?:bonus action|reaction)\b|\bas a (?:\{@variantrule )?bonus action\b[^."]{0,20}\{@action|\bbonus action on each of your turns in combat\b|\bgranted by your Cunning Action\b/i,
  spells:
    /"additionalSpells":|\byou (?:can|may) cast (?:the )?\{@spell [^}]+\}[^."]{0,40}\b(?:at will|once)\b|\bwithout expending a spell slot\b|\balways (?:have|has) (?!prepared)[^."]{1,80}\bprepared\b|\byou (?:learn|know) (?:the )?\{@spell [^}]+\} (?:cantrip|spell)\b|\bspells? of your choice from any\b/i,
  poolCost:
    /"consumes":\{"name":"(?:Ki|Sorcery Point|Channel Divinity|Superiority Die|Psionic Energy Die)"|\b(?:spend|expend)s? (?:up to )?(?:\d+|one|two|three|four|five|six) (?:ki|sorcery) points?/i,
  triggered:
    /\bwhen you (?:roll (?:for )?(?:\{@\w+ )?[Ii]nitiative|reduce [^."]{0,60}to 0 hit points|(?:kill|destroy) [^."]{0,60}with a spell)/i,
  uses: /\bnumber of times equal to\b|\bregain (?:all |one |any )?(?:of )?(?:its |your )?expended uses\b|\buse (?:it|this feature) (?:again|twice|three times)\b|\b(?:can't|cannot) (?:use|do so|cast)[^."]{0,40} again until\b/i,
};

type Bucket = Kind | "unclassified";
const KINDS = Object.keys(KIND_PATTERNS) as Kind[];
const BUCKETS: Bucket[] = [...KINDS, "unclassified"];

type Gaps = Record<string, Record<Bucket, string[]>>;
export type Counts = Record<Bucket, number>;
export type SourceCounts = Record<string, Counts>;

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

/** A feature, or a trait of a race, subrace or background, as the report reads it. */
type Unit = {
  name: string;
  source: string;
  edition: string;
  json: string;
  uses: number | null;
  label: string;
  recorded: boolean;
  poolKey: string | undefined;
};

const RECORDED = new Set(
  FEATURE_MECHANICS.map(({ ref }) => ("className" in ref ? featureKey(ref) : refKey(ref))),
);

const RACE_RECORDED = new Set(
  FEATURE_MECHANICS.flatMap(({ ref, races }) =>
    (races ?? []).map((owner) => `${refKey(ref)}|${owner}`),
  ),
);

/** A record without a class or races, which a trait shares only where a feat has the same `(name, source)`, as Lucky is a halfling's trait and a feat. */
const SHARED_RECORDED = new Set(
  FEATURE_MECHANICS.flatMap(({ ref, races }) => ("className" in ref || races ? [] : [refKey(ref)])),
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

const inScope = (edition: string, json: string) =>
  edition === "classic" || Boolean((JSON.parse(json) as { srd52?: unknown }).srd52);

/** Entries that describe a race without granting anything the sheet applies. */
const DESCRIPTIVE_TRAITS = new Set([
  "Age",
  "Alignment",
  "Creature Type",
  "Language",
  "Languages",
  "Size",
  "Speed",
]);

type Entry = { name?: unknown };
type TraitRow = {
  name: string;
  source: string;
  edition: string;
  json: string;
  trait_uses: string | null;
  race_name?: string;
  race_source?: string;
};

const namedEntries = (json: string): (Entry & { name: string })[] =>
  ((JSON.parse(json) as { entries?: unknown[] }).entries ?? []).filter(
    (entry): entry is Entry & { name: string } =>
      typeof entry === "object" && entry !== null && typeof (entry as Entry).name === "string",
  );

function traitUnits(db: Database.Database): Unit[] {
  const feats = new Set(
    (db.prepare("SELECT name, source FROM feats").all() as { name: string; source: string }[]).map(
      refKey,
    ),
  );
  const races = db
    .prepare("SELECT name, source, edition, json, trait_uses FROM races")
    .all() as TraitRow[];
  const subraces = db
    .prepare("SELECT name, source, edition, json, trait_uses, race_name, race_source FROM subraces")
    .all() as TraitRow[];
  const backgrounds = db
    .prepare("SELECT name, source, edition, json FROM backgrounds")
    .all() as TraitRow[];
  const parentTraits = new Map(
    races.map((race) => [
      refKey(race),
      new Map(namedEntries(race.json).map((entry) => [entry.name, JSON.stringify(entry)])),
    ]),
  );
  const unit = (
    row: TraitRow,
    entry: Entry & { name: string },
    owner: string,
    whose: string,
  ): Unit => ({
    name: entry.name,
    source: row.source,
    edition: row.edition,
    json: JSON.stringify(entry),
    uses: row.trait_uses && entry.name in JSON.parse(row.trait_uses) ? 1 : null,
    label: `${entry.name} (${row.source}), ${whose}`,
    recorded:
      RACE_RECORDED.has(`${entry.name}|${row.source}|${owner}`) ||
      (feats.has(refKey({ name: entry.name, source: row.source })) &&
        SHARED_RECORDED.has(`${entry.name}|${row.source}`)),
    poolKey: undefined,
  });
  const inherited = (row: TraitRow, entry: Entry & { name: string }) =>
    parentTraits
      .get(refKey({ name: row.race_name ?? "", source: row.race_source ?? "" }))
      ?.get(entry.name) === JSON.stringify(entry);
  return [
    ...races.flatMap((row) =>
      namedEntries(row.json)
        .filter((entry) => !DESCRIPTIVE_TRAITS.has(entry.name))
        .map((entry) => unit(row, entry, refKey(row), row.name)),
    ),
    ...subraces.flatMap((row) =>
      namedEntries(row.json)
        .filter((entry) => !DESCRIPTIVE_TRAITS.has(entry.name) && !inherited(row, entry))
        .map((entry) =>
          unit(
            row,
            entry,
            `${row.race_name}|${row.race_source}|${refKey(row)}`,
            `${row.race_name} (${row.name})`,
          ),
        ),
    ),
    ...backgrounds.flatMap((row) =>
      namedEntries(row.json).flatMap((entry) => {
        const feature = /Feature: (.+)$/.exec(entry.name)?.[1];
        return feature
          ? [
              {
                ...unit(row, entry, refKey(row), row.name),
                name: feature,
                label: `${feature} (${row.source}), ${row.name}`,
                recorded: RECORDED.has(`${feature}|${row.source}`),
              },
            ]
          : [];
      }),
    ),
  ];
}

function featureUnits(db: Database.Database): Unit[] {
  return QUERIES.flatMap((query) => db.prepare(query).all() as FeatureRow[]).map((row) => ({
    name: row.name,
    source: row.source,
    edition: row.edition,
    json: row.json,
    uses: row.uses,
    label: labelOf(row),
    recorded: RECORDED.has(keyOf(row)),
    poolKey: featurePoolKey(row),
  }));
}

export function mechanicGaps(db: Database.Database): Gaps {
  const rows = [...featureUnits(db), ...traitUnits(db)].filter(
    (row) => !row.recorded && inScope(row.edition, row.json),
  );
  const suggests = (row: Unit, kind: Kind) =>
    KIND_PATTERNS[kind].test(row.json) &&
    (kind !== "uses" || (row.uses === null && row.poolKey === undefined)) &&
    ((kind !== "convert" &&
      kind !== "slotRecovery" &&
      kind !== "regain" &&
      kind !== "dc" &&
      kind !== "triggered") ||
      row.edition === "classic") &&
    (kind !== "poolCost" || (row.edition === "classic" && !featureCostRecorded(row)));
  const matches = (row: Unit, bucket: Bucket) =>
    bucket === "unclassified" ? KINDS.every((kind) => !suggests(row, kind)) : suggests(row, bucket);
  const sources = [...new Set(rows.map((row) => row.source))].sort();
  return Object.fromEntries(
    sources.map((source) => [
      source,
      Object.fromEntries(
        BUCKETS.map((bucket) => [
          bucket,
          rows
            .filter((row) => row.source === source && matches(row, bucket))
            .map((row) => row.label)
            .sort(),
        ]),
      ),
    ]),
  ) as Gaps;
}

const BASELINE_FILE = join(import.meta.dirname, "../mechanic-gaps.json");

export function countGaps(gaps: Gaps): SourceCounts {
  return Object.fromEntries(
    Object.entries(gaps).map(([source, buckets]) => [
      source,
      Object.fromEntries(BUCKETS.map((bucket) => [bucket, buckets[bucket].length])) as Counts,
    ]),
  );
}

export function readBaseline(file = BASELINE_FILE): Record<string, Partial<Counts>> {
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, Partial<Counts>>;
}

const sourcesOf = (counts: SourceCounts, baseline: Record<string, Partial<Counts>>) =>
  [...new Set([...Object.keys(counts), ...Object.keys(baseline)])].sort();

/** The `source bucket` pairs whose count rose past the baseline; one the baseline lacks starts at zero. */
export function risen(counts: SourceCounts, baseline: Record<string, Partial<Counts>>): string[] {
  return sourcesOf(counts, baseline).flatMap((source) =>
    BUCKETS.filter(
      (bucket) => (counts[source]?.[bucket] ?? 0) > (baseline[source]?.[bucket] ?? 0),
    ).map((bucket) => `${source} ${bucket}`),
  );
}

/** Writes `counts` over the baseline where nothing rose and something fell. */
export function lowerBaseline(counts: SourceCounts, file = BASELINE_FILE): boolean {
  const baseline = readBaseline(file);
  if (risen(counts, baseline).length > 0) return false;
  const same = sourcesOf(counts, baseline).every((source) =>
    BUCKETS.every(
      (bucket) => (counts[source]?.[bucket] ?? 0) === (baseline[source]?.[bucket] ?? 0),
    ),
  );
  if (same) return false;
  const kept = Object.entries(counts).filter(([, bySource]) =>
    BUCKETS.some((bucket) => bySource[bucket] > 0),
  );
  writeFileSync(file, `${JSON.stringify(Object.fromEntries(kept), null, 2)}\n`);
  return true;
}

export function reportGaps(gaps: Gaps, baseline: Record<string, Partial<Counts>>): string[] {
  const lines = ["Features with no recorded mechanic or narrative mark, by source and kind:"];
  for (const [source, buckets] of Object.entries(gaps)) {
    lines.push(`${source}`);
    for (const bucket of BUCKETS) {
      if (buckets[bucket].length === 0) continue;
      const was = baseline[source]?.[bucket] ?? 0;
      const mark = buckets[bucket].length > was ? ` — up from ${was}` : "";
      lines.push(`  ${bucket} ${buckets[bucket].length}${mark}`);
      for (const label of buckets[bucket]) lines.push(`    ${label}`);
    }
  }
  return lines;
}

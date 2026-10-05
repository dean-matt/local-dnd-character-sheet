import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_SCHEMA } from "@dnd/content/schema";
import { EDITIONS } from "@dnd/rules";
import Database from "better-sqlite3";

export type SpellFixtureRow = {
  name: string;
  source: string;
  edition: string;
  level: number;
  school: string;
  concentration: 0 | 1;
  ritual: 0 | 1;
  json: string;
};

export type RaceFixtureRow = {
  name: string;
  source: string;
  edition: string;
  json: string;
};

export type SubraceFixtureRow = {
  name: string;
  source: string;
  race_name: string;
  race_source: string;
  edition: string;
  json: string;
};

export type BackgroundFixtureRow = RaceFixtureRow;
export type FeatFixtureRow = RaceFixtureRow;
export type MetaFixtureRow = { key: string; value: string };

export type ItemFixtureRow = {
  name: string;
  source: string;
  edition: string;
  kind: string;
  type: string | null;
  rarity: string | null;
  requires_attunement: 0 | 1;
  json: string;
};

let publishCount = 0;

function placeholder(column: { name: string; type: string }): string | number {
  if (column.name === "edition") return EDITIONS[0];
  return column.type === "INTEGER" ? 1 : "";
}

/**
 * Publishes a fresh `content.db` built from `CONTENT_SCHEMA` itself, mirroring
 * `build-db.ts`'s publish step: a content-addressed file under `<dataDir>/content/`, made
 * live by rewriting the `current` pointer rather than a rename `openContentDb`'s docs say
 * Windows refuses. Each key is a table in camel case, `classResources` for
 * `class_resources`, and a read spanning tables finds them all in one connection.
 *
 * A row names only the columns its test cares about. Each NOT NULL column it leaves out
 * gets the first edition, 1 for an integer or an empty string, which the edition and
 * range CHECK constraints accept. Rows stay small, a value no real build could hold fails
 * its insert, and a column the schema no longer has fails the insert or the query that
 * names it.
 *
 * Built in memory and written in one call: built on disk, each autocommitted insert
 * creates and deletes a journal file, and a hosted Windows runner took up to 3 s a fixture.
 */
function publishContent(dataDir: string, tables: Record<string, object[] | undefined>): void {
  const contentDir = join(dataDir, "content");
  mkdirSync(contentDir, { recursive: true });
  const name = `content-test-${publishCount++}.db`;
  const db = new Database(":memory:");
  db.exec(CONTENT_SCHEMA);
  for (const [key, rows] of Object.entries(tables)) {
    const table = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    const required = db
      .prepare<[string], { name: string; type: string }>(
        'SELECT name, type FROM pragma_table_info(?) WHERE "notnull" AND dflt_value IS NULL',
      )
      .all(table);
    for (const row of rows ?? []) {
      const filled: Record<string, unknown> = { ...row };
      for (const column of required) filled[column.name] ??= placeholder(column);
      const columns = Object.keys(filled);
      db.prepare(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map((c) => `@${c}`).join(", ")})`,
      ).run(filled);
    }
  }
  writeFileSync(join(contentDir, name), db.serialize());
  db.close();
  writeFileSync(join(contentDir, "current.tmp"), name);
  renameSync(join(contentDir, "current.tmp"), join(contentDir, "current"));
}

export function publishMeta(dataDir: string, rows: MetaFixtureRow[]): void {
  publishContent(dataDir, { meta: rows });
}

export function publishSpells(dataDir: string, rows: SpellFixtureRow[]): void {
  publishContent(dataDir, { spells: rows });
}

export function publishRaces(dataDir: string, rows: RaceFixtureRow[]): void {
  publishContent(dataDir, { races: rows });
}

export function publishSubraces(dataDir: string, rows: SubraceFixtureRow[]): void {
  publishContent(dataDir, { subraces: rows });
}

export function publishBackgrounds(dataDir: string, rows: BackgroundFixtureRow[]): void {
  publishContent(dataDir, { backgrounds: rows });
}

export function publishFeats(dataDir: string, rows: FeatFixtureRow[]): void {
  publishContent(dataDir, { feats: rows });
}

export function publishItems(dataDir: string, rows: ItemFixtureRow[]): void {
  publishContent(dataDir, { items: rows });
}

type EntityFixtureRow = {
  type: string;
  name: string;
  source: string;
  qualifier: string;
  edition: string | null;
  json: string;
  rendered_text: string;
};

export type SearchFixture = {
  spells?: SpellFixtureRow[];
  items?: ItemFixtureRow[];
  races?: RaceFixtureRow[];
  backgrounds?: BackgroundFixtureRow[];
  feats?: FeatFixtureRow[];
  classes?: ClassFixtureRow[];
  subclasses?: SubclassFixtureRow[];
  optionalFeatures?: RaceFixtureRow[];
  lookups?: LookupFixtureRow[];
  entities?: EntityFixtureRow[];
};

export function publishSearchFixture(dataDir: string, fixture: SearchFixture): void {
  publishContent(dataDir, fixture);
}

type ClassFixtureRow = {
  name: string;
  source: string;
  edition: string;
  hit_die: number;
  json: string;
};

type SubclassFixtureRow = {
  name: string;
  source: string;
  short_name: string;
  class_name: string;
  class_source: string;
  edition: string;
  json: string;
};

type ClassResourceFixtureRow = {
  class_name: string;
  class_source: string;
  level: number;
  resource_key: string;
  value: string;
};

type SpellSlotFixtureRow = {
  class_name: string;
  class_source: string;
  level: number;
  slot_level: number;
  slots: number;
};

type ClassOptionalFeatureFixtureRow = {
  class_name: string;
  class_source: string;
  level: number;
  feature_type: string;
  known: number;
};

type ClassFeatureFixtureRow = {
  name: string;
  source: string;
  class_name: string;
  class_source: string;
  level: number;
  edition: string;
  json: string;
};

type SubclassResourceFixtureRow = ClassResourceFixtureRow & {
  subclass_name: string;
  subclass_source: string;
};

type SubclassSpellSlotFixtureRow = SpellSlotFixtureRow & {
  subclass_name: string;
  subclass_source: string;
};

type SubclassOptionalFeatureFixtureRow = ClassOptionalFeatureFixtureRow & {
  subclass_name: string;
  subclass_source: string;
};

type SubclassFeatureFixtureRow = {
  name: string;
  source: string;
  class_name: string;
  class_source: string;
  subclass_short_name: string;
  subclass_source: string;
  level: number;
  edition: string;
  json: string;
};

export type ClassFixture = {
  classes?: ClassFixtureRow[];
  subclasses?: SubclassFixtureRow[];
  classResources?: ClassResourceFixtureRow[];
  spellSlots?: SpellSlotFixtureRow[];
  classOptionalFeatures?: ClassOptionalFeatureFixtureRow[];
  classFeatures?: ClassFeatureFixtureRow[];
  subclassResources?: SubclassResourceFixtureRow[];
  subclassSpellSlots?: SubclassSpellSlotFixtureRow[];
  subclassOptionalFeatures?: SubclassOptionalFeatureFixtureRow[];
  subclassFeatures?: SubclassFeatureFixtureRow[];
};

export function publishClasses(dataDir: string, fixture: ClassFixture): void {
  publishContent(dataDir, fixture);
}

type LookupFixtureRow = {
  kind: string;
  name: string;
  source: string;
  qualifier?: string;
  edition: string | null;
  json: string;
};

export type DerivedFixture = {
  classes?: ClassFixtureRow[];
  classResources?: ClassResourceFixtureRow[];
  spellSlots?: SpellSlotFixtureRow[];
  subclasses?: SubclassFixtureRow[];
  subclassResources?: SubclassResourceFixtureRow[];
  subclassSpellSlots?: SubclassSpellSlotFixtureRow[];
  races?: RaceFixtureRow[];
  subraces?: SubraceFixtureRow[];
  items?: ItemFixtureRow[];
  lookups?: LookupFixtureRow[];
};

export function publishDerivedFixture(dataDir: string, fixture: DerivedFixture): void {
  publishContent(dataDir, fixture);
}

export type FeaturesFixture = {
  classes?: ClassFixtureRow[];
  subclasses?: SubclassFixtureRow[];
  classFeatures?: ClassFeatureFixtureRow[];
  subclassFeatures?: SubclassFeatureFixtureRow[];
  races?: RaceFixtureRow[];
  subraces?: SubraceFixtureRow[];
  backgrounds?: BackgroundFixtureRow[];
  feats?: FeatFixtureRow[];
  optionalFeatures?: FeatFixtureRow[];
};

export function publishFeaturesFixture(dataDir: string, fixture: FeaturesFixture): void {
  publishContent(dataDir, fixture);
}

/** The rows `resolveRefs` reads, each table carrying only the columns it selects. */
export type RefsFixture = {
  spells?: { name: string; source: string; json: string }[];
  races?: { name: string; source: string; json: string }[];
  subraces?: {
    name: string;
    full_name: string;
    source: string;
    race_name: string;
    race_source: string;
    json: string;
  }[];
  subclasses?: {
    name: string;
    source: string;
    short_name: string;
    class_name: string;
    class_source: string;
    json: string;
  }[];
  classFeatures?: {
    name: string;
    source: string;
    class_name: string;
    class_source: string;
    level: number;
    json: string;
  }[];
  subclassFeatures?: {
    name: string;
    source: string;
    class_name: string;
    class_source: string;
    subclass_short_name: string;
    subclass_source: string;
    level: number;
    json: string;
  }[];
  optionalFeatures?: { name: string; source: string; json: string }[];
  lookups?: { kind: string; name: string; source: string; qualifier: string; json: string }[];
  entities?: { type: string; name: string; source: string; qualifier: string; json: string }[];
  tagRedirects?: { tag: string; from_key: string; to_tag: string; to_key: string }[];
};

export function publishRefsFixture(dataDir: string, fixture: RefsFixture): void {
  publishContent(dataDir, fixture);
}

type KeyRow = { name: string; source: string };

/** The rows `checkCharacterReferences` reads, each table carrying only its key. */
export type ReferencesFixture = {
  classes?: KeyRow[];
  subclasses?: (KeyRow & { class_name: string; class_source: string })[];
  races?: KeyRow[];
  subraces?: (KeyRow & { race_name: string; race_source: string })[];
  backgrounds?: KeyRow[];
  items?: ItemFixtureRow[];
  spells?: SpellFixtureRow[];
  feats?: KeyRow[];
  optionalFeatures?: KeyRow[];
  lookups?: (KeyRow & { kind: string; qualifier: string })[];
  tagRedirects?: { tag: string; from_key: string; to_tag: string; to_key: string }[];
};

export function publishReferencesFixture(dataDir: string, fixture: ReferencesFixture): void {
  publishContent(dataDir, fixture);
}

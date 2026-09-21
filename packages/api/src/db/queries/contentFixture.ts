import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

type Insertion = { insert: string; rows: object[] };

/**
 * Publishes a fresh `content.db` holding one or more tables, mirroring `build-db.ts`'s
 * publish step: a content-addressed file under `<dataDir>/content/`, made live by
 * rewriting the `current` pointer rather than a rename `openContentDb`'s docs say
 * Windows refuses. One `ddl` and several `insertions` where a read spans tables in one
 * connection, such as a class's resources, slots and features at a level.
 */
function publishTable(dataDir: string, ddl: string, insertions: Insertion[]): void {
  const contentDir = join(dataDir, "content");
  mkdirSync(contentDir, { recursive: true });
  const name = `content-test-${publishCount++}.db`;
  const db = new Database(join(contentDir, name));
  db.exec(ddl);
  for (const { insert, rows } of insertions) {
    const stmt = db.prepare(insert);
    for (const row of rows) stmt.run(row);
  }
  db.close();
  writeFileSync(join(contentDir, "current.tmp"), name);
  renameSync(join(contentDir, "current.tmp"), join(contentDir, "current"));
}

/** Mirrors `build-db.ts`'s publish step against a minimal `meta` table. */
export function publishMeta(dataDir: string, rows: MetaFixtureRow[]): void {
  publishTable(
    dataDir,
    `
      CREATE TABLE meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) STRICT;
    `,
    [
      {
        insert: "INSERT INTO meta (key, value) VALUES (@key, @value)",
        rows,
      },
    ],
  );
}

/** Mirrors `build-db.ts`'s publish step against a minimal `spells` table. */
export function publishSpells(dataDir: string, rows: SpellFixtureRow[]): void {
  publishTable(
    dataDir,
    `
      CREATE TABLE spells (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        level INTEGER NOT NULL,
        school TEXT NOT NULL,
        concentration INTEGER NOT NULL,
        ritual INTEGER NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;
    `,
    [
      {
        insert:
          "INSERT INTO spells (name, source, edition, level, school, concentration, ritual, json) VALUES (@name, @source, @edition, @level, @school, @concentration, @ritual, @json)",
        rows,
      },
    ],
  );
}

/** Mirrors `build-db.ts`'s publish step against a minimal `races` table. */
export function publishRaces(dataDir: string, rows: RaceFixtureRow[]): void {
  publishTable(
    dataDir,
    `
      CREATE TABLE races (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;
    `,
    [
      {
        insert:
          "INSERT INTO races (name, source, edition, json) VALUES (@name, @source, @edition, @json)",
        rows,
      },
    ],
  );
}

/** Mirrors `build-db.ts`'s publish step against a minimal `subraces` table. */
export function publishSubraces(dataDir: string, rows: SubraceFixtureRow[]): void {
  publishTable(
    dataDir,
    `
      CREATE TABLE subraces (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        race_name TEXT NOT NULL,
        race_source TEXT NOT NULL,
        edition TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source, race_name, race_source)
      ) STRICT;
    `,
    [
      {
        insert:
          "INSERT INTO subraces (name, source, race_name, race_source, edition, json) VALUES (@name, @source, @race_name, @race_source, @edition, @json)",
        rows,
      },
    ],
  );
}

/** Mirrors `build-db.ts`'s publish step against a minimal `backgrounds` table. */
export function publishBackgrounds(dataDir: string, rows: BackgroundFixtureRow[]): void {
  publishTable(
    dataDir,
    `
      CREATE TABLE backgrounds (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;
    `,
    [
      {
        insert:
          "INSERT INTO backgrounds (name, source, edition, json) VALUES (@name, @source, @edition, @json)",
        rows,
      },
    ],
  );
}

/** Mirrors `build-db.ts`'s publish step against a minimal `feats` table. */
export function publishFeats(dataDir: string, rows: FeatFixtureRow[]): void {
  publishTable(
    dataDir,
    `
      CREATE TABLE feats (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;
    `,
    [
      {
        insert:
          "INSERT INTO feats (name, source, edition, json) VALUES (@name, @source, @edition, @json)",
        rows,
      },
    ],
  );
}

/** Mirrors `build-db.ts`'s publish step against a minimal `items` table. */
export function publishItems(dataDir: string, rows: ItemFixtureRow[]): void {
  publishTable(
    dataDir,
    `
      CREATE TABLE items (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        kind TEXT NOT NULL,
        type TEXT,
        rarity TEXT,
        requires_attunement INTEGER NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;
    `,
    [
      {
        insert:
          "INSERT INTO items (name, source, edition, kind, type, rarity, requires_attunement, json) VALUES (@name, @source, @edition, @kind, @type, @rarity, @requires_attunement, @json)",
        rows,
      },
    ],
  );
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

/**
 * `entities`, its FTS5 index and the triggers `schema.ts` documents an external-content
 * table needs to stay current — an insert with no trigger leaves `entities_fts` searching
 * nothing.
 */
const ENTITIES_DDL = `
  CREATE TABLE entities (
    type          TEXT NOT NULL,
    name          TEXT NOT NULL,
    source        TEXT NOT NULL,
    qualifier     TEXT NOT NULL,
    edition       TEXT,
    json          TEXT NOT NULL,
    rendered_text TEXT NOT NULL,
    PRIMARY KEY (type, name, source, qualifier)
  ) STRICT;

  CREATE VIRTUAL TABLE entities_fts USING fts5 (
    name,
    rendered_text,
    content = 'entities',
    content_rowid = 'rowid',
    tokenize = 'porter unicode61'
  );

  CREATE TRIGGER entities_fts_insert AFTER INSERT ON entities BEGIN
    INSERT INTO entities_fts (rowid, name, rendered_text)
    VALUES (new.rowid, new.name, new.rendered_text);
  END;

  CREATE TRIGGER entities_fts_delete AFTER DELETE ON entities BEGIN
    INSERT INTO entities_fts (entities_fts, rowid, name, rendered_text)
    VALUES ('delete', old.rowid, old.name, old.rendered_text);
  END;

  CREATE TRIGGER entities_fts_update AFTER UPDATE ON entities BEGIN
    INSERT INTO entities_fts (entities_fts, rowid, name, rendered_text)
    VALUES ('delete', old.rowid, old.name, old.rendered_text);
    INSERT INTO entities_fts (rowid, name, rendered_text)
    VALUES (new.rowid, new.name, new.rendered_text);
  END;
`;

const ENTITIES_INSERT =
  "INSERT INTO entities (type, name, source, qualifier, edition, json, rendered_text) VALUES (@type, @name, @source, @qualifier, @edition, @json, @rendered_text)";

export type SearchFixture = {
  spells?: SpellFixtureRow[];
  items?: ItemFixtureRow[];
  races?: RaceFixtureRow[];
  backgrounds?: BackgroundFixtureRow[];
  feats?: FeatFixtureRow[];
  classes?: ClassFixtureRow[];
  optionalFeatures?: RaceFixtureRow[];
  entities?: EntityFixtureRow[];
};

/**
 * Mirrors `build-db.ts`'s publish step against every table `searchCatalog` reads — the
 * seven Tier A tables `CATALOG_SEARCH_TABLES` names, plus `entities` — since a search
 * spans them all in one connection.
 */
export function publishSearchFixture(dataDir: string, fixture: SearchFixture): void {
  publishTable(
    dataDir,
    `
      CREATE TABLE spells (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        level INTEGER NOT NULL,
        school TEXT NOT NULL,
        concentration INTEGER NOT NULL,
        ritual INTEGER NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;

      CREATE TABLE items (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        kind TEXT NOT NULL,
        type TEXT,
        rarity TEXT,
        requires_attunement INTEGER NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;

      CREATE TABLE races (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;

      CREATE TABLE backgrounds (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;

      CREATE TABLE feats (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;

      CREATE TABLE classes (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        hit_die INTEGER NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;

      CREATE TABLE optional_features (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;

      ${ENTITIES_DDL}
    `,
    [
      {
        insert:
          "INSERT INTO spells (name, source, edition, level, school, concentration, ritual, json) VALUES (@name, @source, @edition, @level, @school, @concentration, @ritual, @json)",
        rows: fixture.spells ?? [],
      },
      {
        insert:
          "INSERT INTO items (name, source, edition, kind, type, rarity, requires_attunement, json) VALUES (@name, @source, @edition, @kind, @type, @rarity, @requires_attunement, @json)",
        rows: fixture.items ?? [],
      },
      {
        insert:
          "INSERT INTO races (name, source, edition, json) VALUES (@name, @source, @edition, @json)",
        rows: fixture.races ?? [],
      },
      {
        insert:
          "INSERT INTO backgrounds (name, source, edition, json) VALUES (@name, @source, @edition, @json)",
        rows: fixture.backgrounds ?? [],
      },
      {
        insert:
          "INSERT INTO feats (name, source, edition, json) VALUES (@name, @source, @edition, @json)",
        rows: fixture.feats ?? [],
      },
      {
        insert:
          "INSERT INTO classes (name, source, edition, hit_die, json) VALUES (@name, @source, @edition, @hit_die, @json)",
        rows: fixture.classes ?? [],
      },
      {
        insert:
          "INSERT INTO optional_features (name, source, edition, json) VALUES (@name, @source, @edition, @json)",
        rows: fixture.optionalFeatures ?? [],
      },
      { insert: ENTITIES_INSERT, rows: fixture.entities ?? [] },
    ],
  );
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

/**
 * Mirrors `build-db.ts`'s publish step against the ten class tables together — a
 * class-at-a-level read spans several of them in one connection, so the fixture has to
 * hold them all at once rather than one `publishTable` call per table.
 */
export function publishClasses(dataDir: string, fixture: ClassFixture): void {
  publishTable(
    dataDir,
    `
      CREATE TABLE classes (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        edition TEXT NOT NULL,
        hit_die INTEGER NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source)
      ) STRICT;

      CREATE TABLE subclasses (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        short_name TEXT NOT NULL,
        class_name TEXT NOT NULL,
        class_source TEXT NOT NULL,
        edition TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source, class_name, class_source)
      ) STRICT;

      CREATE TABLE class_resources (
        class_name TEXT NOT NULL,
        class_source TEXT NOT NULL,
        level INTEGER NOT NULL,
        resource_key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (class_name, class_source, level, resource_key)
      ) STRICT;

      CREATE TABLE spell_slots (
        class_name TEXT NOT NULL,
        class_source TEXT NOT NULL,
        level INTEGER NOT NULL,
        slot_level INTEGER NOT NULL,
        slots INTEGER NOT NULL,
        PRIMARY KEY (class_name, class_source, level, slot_level)
      ) STRICT;

      CREATE TABLE class_optional_features (
        class_name TEXT NOT NULL,
        class_source TEXT NOT NULL,
        level INTEGER NOT NULL,
        feature_type TEXT NOT NULL,
        known INTEGER NOT NULL,
        PRIMARY KEY (class_name, class_source, level, feature_type)
      ) STRICT;

      CREATE TABLE class_features (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        class_name TEXT NOT NULL,
        class_source TEXT NOT NULL,
        level INTEGER NOT NULL,
        edition TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source, class_name, class_source, level)
      ) STRICT;

      CREATE TABLE subclass_resources (
        class_name TEXT NOT NULL,
        class_source TEXT NOT NULL,
        subclass_name TEXT NOT NULL,
        subclass_source TEXT NOT NULL,
        level INTEGER NOT NULL,
        resource_key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (class_name, class_source, subclass_name, subclass_source, level, resource_key)
      ) STRICT;

      CREATE TABLE subclass_spell_slots (
        class_name TEXT NOT NULL,
        class_source TEXT NOT NULL,
        subclass_name TEXT NOT NULL,
        subclass_source TEXT NOT NULL,
        level INTEGER NOT NULL,
        slot_level INTEGER NOT NULL,
        slots INTEGER NOT NULL,
        PRIMARY KEY (class_name, class_source, subclass_name, subclass_source, level, slot_level)
      ) STRICT;

      CREATE TABLE subclass_optional_features (
        class_name TEXT NOT NULL,
        class_source TEXT NOT NULL,
        subclass_name TEXT NOT NULL,
        subclass_source TEXT NOT NULL,
        level INTEGER NOT NULL,
        feature_type TEXT NOT NULL,
        known INTEGER NOT NULL,
        PRIMARY KEY (class_name, class_source, subclass_name, subclass_source, level, feature_type)
      ) STRICT;

      CREATE TABLE subclass_features (
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        class_name TEXT NOT NULL,
        class_source TEXT NOT NULL,
        subclass_short_name TEXT NOT NULL,
        subclass_source TEXT NOT NULL,
        level INTEGER NOT NULL,
        edition TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (name, source, class_name, class_source, subclass_short_name, subclass_source, level)
      ) STRICT;
    `,
    [
      {
        insert:
          "INSERT INTO classes (name, source, edition, hit_die, json) VALUES (@name, @source, @edition, @hit_die, @json)",
        rows: fixture.classes ?? [],
      },
      {
        insert:
          "INSERT INTO subclasses (name, source, short_name, class_name, class_source, edition, json) VALUES (@name, @source, @short_name, @class_name, @class_source, @edition, @json)",
        rows: fixture.subclasses ?? [],
      },
      {
        insert:
          "INSERT INTO class_resources (class_name, class_source, level, resource_key, value) VALUES (@class_name, @class_source, @level, @resource_key, @value)",
        rows: fixture.classResources ?? [],
      },
      {
        insert:
          "INSERT INTO spell_slots (class_name, class_source, level, slot_level, slots) VALUES (@class_name, @class_source, @level, @slot_level, @slots)",
        rows: fixture.spellSlots ?? [],
      },
      {
        insert:
          "INSERT INTO class_optional_features (class_name, class_source, level, feature_type, known) VALUES (@class_name, @class_source, @level, @feature_type, @known)",
        rows: fixture.classOptionalFeatures ?? [],
      },
      {
        insert:
          "INSERT INTO class_features (name, source, class_name, class_source, level, edition, json) VALUES (@name, @source, @class_name, @class_source, @level, @edition, @json)",
        rows: fixture.classFeatures ?? [],
      },
      {
        insert:
          "INSERT INTO subclass_resources (class_name, class_source, subclass_name, subclass_source, level, resource_key, value) VALUES (@class_name, @class_source, @subclass_name, @subclass_source, @level, @resource_key, @value)",
        rows: fixture.subclassResources ?? [],
      },
      {
        insert:
          "INSERT INTO subclass_spell_slots (class_name, class_source, subclass_name, subclass_source, level, slot_level, slots) VALUES (@class_name, @class_source, @subclass_name, @subclass_source, @level, @slot_level, @slots)",
        rows: fixture.subclassSpellSlots ?? [],
      },
      {
        insert:
          "INSERT INTO subclass_optional_features (class_name, class_source, subclass_name, subclass_source, level, feature_type, known) VALUES (@class_name, @class_source, @subclass_name, @subclass_source, @level, @feature_type, @known)",
        rows: fixture.subclassOptionalFeatures ?? [],
      },
      {
        insert:
          "INSERT INTO subclass_features (name, source, class_name, class_source, subclass_short_name, subclass_source, level, edition, json) VALUES (@name, @source, @class_name, @class_source, @subclass_short_name, @subclass_source, @level, @edition, @json)",
        rows: fixture.subclassFeatures ?? [],
      },
    ],
  );
}

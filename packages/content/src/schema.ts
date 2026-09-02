/**
 * DDL for `content.db` — the read-only catalog built from 5etools data.
 *
 * This database is regenerated wholesale by `pnpm content:build` and is never
 * migrated. Changing the shape here means rebuilding, not writing a migration.
 *
 * Tiers, as decided in docs/architecture.md:
 *   A  bespoke tables the sheet queries directly
 *   B  thin lookup tables that resolve {@tag} references and fill pickers
 *   C  one generic table for everything else, so no tag ever dangles
 */
export const CONTENT_SCHEMA = /* sql */ `
PRAGMA journal_mode = WAL;

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

-- Tier A ---------------------------------------------------------------------

CREATE TABLE classes (
  name        TEXT NOT NULL,
  source      TEXT NOT NULL,
  edition     TEXT NOT NULL CHECK (edition IN ('classic', 'one')),
  hit_die     INTEGER NOT NULL,
  json        TEXT NOT NULL,
  PRIMARY KEY (name, source)
) STRICT;

CREATE TABLE subclasses (
  name         TEXT NOT NULL,
  source       TEXT NOT NULL,
  class_name   TEXT NOT NULL,
  class_source TEXT NOT NULL,
  edition      TEXT NOT NULL CHECK (edition IN ('classic', 'one')),
  json         TEXT NOT NULL,
  PRIMARY KEY (name, source, class_name, class_source)
) STRICT;

CREATE TABLE class_resources (
  class_name   TEXT NOT NULL,
  class_source TEXT NOT NULL,
  level        INTEGER NOT NULL CHECK (level BETWEEN 1 AND 20),
  resource_key TEXT NOT NULL,
  value        TEXT NOT NULL,
  PRIMARY KEY (class_name, class_source, level, resource_key)
) STRICT;

CREATE TABLE spell_slots (
  class_name   TEXT NOT NULL,
  class_source TEXT NOT NULL,
  level        INTEGER NOT NULL CHECK (level BETWEEN 1 AND 20),
  slot_level   INTEGER NOT NULL CHECK (slot_level BETWEEN 1 AND 9),
  slots        INTEGER NOT NULL,
  PRIMARY KEY (class_name, class_source, level, slot_level)
) STRICT;

CREATE TABLE spells (
  name        TEXT NOT NULL,
  source      TEXT NOT NULL,
  edition     TEXT NOT NULL CHECK (edition IN ('classic', 'one')),
  level       INTEGER NOT NULL CHECK (level BETWEEN 0 AND 9),
  school      TEXT NOT NULL,
  concentration INTEGER NOT NULL CHECK (concentration IN (0, 1)),
  ritual      INTEGER NOT NULL CHECK (ritual IN (0, 1)),
  json        TEXT NOT NULL,
  PRIMARY KEY (name, source)
) STRICT;

CREATE TABLE items (
  name     TEXT NOT NULL,
  source   TEXT NOT NULL,
  edition  TEXT NOT NULL CHECK (edition IN ('classic', 'one')),
  type     TEXT,
  rarity   TEXT,
  requires_attunement INTEGER NOT NULL CHECK (requires_attunement IN (0, 1)),
  json     TEXT NOT NULL,
  PRIMARY KEY (name, source)
) STRICT;

CREATE TABLE races (
  name    TEXT NOT NULL,
  source  TEXT NOT NULL,
  edition TEXT NOT NULL CHECK (edition IN ('classic', 'one')),
  json    TEXT NOT NULL,
  PRIMARY KEY (name, source)
) STRICT;

CREATE TABLE backgrounds (
  name    TEXT NOT NULL,
  source  TEXT NOT NULL,
  edition TEXT NOT NULL CHECK (edition IN ('classic', 'one')),
  json    TEXT NOT NULL,
  PRIMARY KEY (name, source)
) STRICT;

CREATE TABLE feats (
  name    TEXT NOT NULL,
  source  TEXT NOT NULL,
  edition TEXT NOT NULL CHECK (edition IN ('classic', 'one')),
  json    TEXT NOT NULL,
  PRIMARY KEY (name, source)
) STRICT;

CREATE TABLE optional_features (
  name         TEXT NOT NULL,
  source       TEXT NOT NULL,
  edition      TEXT NOT NULL CHECK (edition IN ('classic', 'one')),
  feature_type TEXT NOT NULL,
  json         TEXT NOT NULL,
  PRIMARY KEY (name, source)
) STRICT;

-- Tier B ---------------------------------------------------------------------

CREATE TABLE lookups (
  kind    TEXT NOT NULL,
  name    TEXT NOT NULL,
  source  TEXT NOT NULL,
  edition TEXT CHECK (edition IS NULL OR edition IN ('classic', 'one')),
  json    TEXT NOT NULL,
  PRIMARY KEY (kind, name, source)
) STRICT;

CREATE INDEX lookups_by_kind ON lookups (kind, name);

-- Tier C ---------------------------------------------------------------------

CREATE TABLE entities (
  type          TEXT NOT NULL,
  name          TEXT NOT NULL,
  source        TEXT NOT NULL,
  edition       TEXT CHECK (edition IS NULL OR edition IN ('classic', 'one')),
  json          TEXT NOT NULL,
  rendered_text TEXT NOT NULL,
  PRIMARY KEY (type, name, source)
) STRICT;

CREATE VIRTUAL TABLE entities_fts USING fts5 (
  name,
  rendered_text,
  content = 'entities',
  tokenize = 'porter unicode61'
);

-- Upstream's own map of renamed and redirected tags, so links survive renames.
CREATE TABLE tag_redirects (
  tag       TEXT NOT NULL,
  from_key  TEXT NOT NULL,
  to_key    TEXT NOT NULL,
  PRIMARY KEY (tag, from_key)
) STRICT;
`;

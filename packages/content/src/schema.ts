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

-- short_name is what a tag and a feature row call this subclass — Berserker,
-- where name is Path of the Berserker. Carried as a column so joining a
-- subclass to its features is SQL rather than json_extract.
CREATE TABLE subclasses (
  name         TEXT NOT NULL,
  source       TEXT NOT NULL,
  short_name   TEXT NOT NULL,
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

-- Six of 322 subclasses carry a table of their own: the third-caster spell
-- progressions, and the Psi Warrior and Soulknife energy dice. Kept apart from
-- the class tables so neither key has to carry an empty subclass.

CREATE TABLE subclass_resources (
  class_name      TEXT NOT NULL,
  class_source    TEXT NOT NULL,
  subclass_name   TEXT NOT NULL,
  subclass_source TEXT NOT NULL,
  level           INTEGER NOT NULL CHECK (level BETWEEN 1 AND 20),
  resource_key    TEXT NOT NULL,
  value           TEXT NOT NULL,
  PRIMARY KEY (class_name, class_source, subclass_name, subclass_source, level, resource_key)
) STRICT;

CREATE TABLE subclass_spell_slots (
  class_name      TEXT NOT NULL,
  class_source    TEXT NOT NULL,
  subclass_name   TEXT NOT NULL,
  subclass_source TEXT NOT NULL,
  level           INTEGER NOT NULL CHECK (level BETWEEN 1 AND 20),
  slot_level      INTEGER NOT NULL CHECK (slot_level BETWEEN 1 AND 9),
  slots           INTEGER NOT NULL,
  PRIMARY KEY (class_name, class_source, subclass_name, subclass_source, level, slot_level)
) STRICT;

-- How many options of a feature type a class knows at a level — the other half
-- of the join optional_feature_types starts, where that table says which options
-- carry a type. Every level that may pick carries a row, since upstream states a
-- count two ways and only one of them says anything about a level it skips.
--
-- known is the running total, not the pick gained at that level: a level 2 XPHB
-- warlock knows 3 invocations, having gained 2. What a level adds is the
-- difference from the level below, so a picker reading known as new options
-- offers too many and the arithmetic still looks plausible.
--
-- A row per level rather than one per plateau: the redundancy buys an absent row
-- that means none, the reading the resource and slot tables above already have,
-- and a key that makes two counts at one level impossible.
--
-- known counts one block, not one character. A class and its subclass can offer
-- the same type, and the character gets both: a level 10 PHB Champion knows two
-- fighting styles, one from each table, so a query over either alone is short.

CREATE TABLE class_optional_features (
  class_name   TEXT NOT NULL,
  class_source TEXT NOT NULL,
  level        INTEGER NOT NULL CHECK (level BETWEEN 1 AND 20),
  feature_type TEXT NOT NULL,
  known        INTEGER NOT NULL CHECK (known > 0),
  PRIMARY KEY (class_name, class_source, level, feature_type)
) STRICT;

CREATE TABLE subclass_optional_features (
  class_name      TEXT NOT NULL,
  class_source    TEXT NOT NULL,
  subclass_name   TEXT NOT NULL,
  subclass_source TEXT NOT NULL,
  level           INTEGER NOT NULL CHECK (level BETWEEN 1 AND 20),
  feature_type    TEXT NOT NULL,
  known           INTEGER NOT NULL CHECK (known > 0),
  PRIMARY KEY (class_name, class_source, subclass_name, subclass_source, level, feature_type)
) STRICT;

-- A feature is the one Tier A entity (name, source) does not identify: 55 class
-- features and 117 subclass features share one with another, and Ability Score
-- Improvement from PHB alone covers 63 rows across twelve classes and five
-- levels. The key is what the classFeature and subclassFeature tags spell out —
-- the owning class, the subclass where there is one, and the level.

CREATE TABLE class_features (
  name         TEXT NOT NULL,
  source       TEXT NOT NULL,
  class_name   TEXT NOT NULL,
  class_source TEXT NOT NULL,
  level        INTEGER NOT NULL CHECK (level BETWEEN 1 AND 20),
  edition      TEXT NOT NULL CHECK (edition IN ('classic', 'one')),
  json         TEXT NOT NULL,
  PRIMARY KEY (name, source, class_name, class_source, level)
) STRICT;

-- subclass_short_name, not the subclass name: a tag names the Berserker, while
-- the subclasses row is the Path of the Berserker.
CREATE TABLE subclass_features (
  name                TEXT NOT NULL,
  source              TEXT NOT NULL,
  class_name          TEXT NOT NULL,
  class_source        TEXT NOT NULL,
  subclass_short_name TEXT NOT NULL,
  subclass_source     TEXT NOT NULL,
  level               INTEGER NOT NULL CHECK (level BETWEEN 1 AND 20),
  edition             TEXT NOT NULL CHECK (edition IN ('classic', 'one')),
  json                TEXT NOT NULL,
  PRIMARY KEY (name, source, class_name, class_source, subclass_short_name, subclass_source, level)
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
  name    TEXT NOT NULL,
  source  TEXT NOT NULL,
  edition TEXT NOT NULL CHECK (edition IN ('classic', 'one')),
  json    TEXT NOT NULL,
  PRIMARY KEY (name, source)
) STRICT;

-- A feature's types are a list upstream: 9 of 213 carry two to four, because one
-- fighting style is offered to several classes. Kept beside the feature rather
-- than in it, so identity stays (name, source) and a character referencing
-- Dueling gets one row however many classes may take it.
CREATE TABLE optional_feature_types (
  name         TEXT NOT NULL,
  source       TEXT NOT NULL,
  feature_type TEXT NOT NULL,
  PRIMARY KEY (name, source, feature_type)
) STRICT;

CREATE INDEX optional_feature_types_by_type ON optional_feature_types (feature_type);

-- Tier B ---------------------------------------------------------------------

-- qualifier is the identity a kind needs beyond (name, source): the pantheon a
-- deity tag names, which five PHB gods need to tell them from a god of another
-- pantheon, and which nothing else in the catalog does. A kind without one
-- stores the empty string, because a STRICT table makes every PRIMARY KEY
-- column NOT NULL and there is no other way to write "this kind has none".
CREATE TABLE lookups (
  kind      TEXT NOT NULL,
  name      TEXT NOT NULL,
  source    TEXT NOT NULL,
  qualifier TEXT NOT NULL,
  edition   TEXT CHECK (edition IS NULL OR edition IN ('classic', 'one')),
  json      TEXT NOT NULL,
  PRIMARY KEY (kind, name, source, qualifier)
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
  content_rowid = 'rowid',
  tokenize = 'porter unicode61'
);

-- An external-content FTS5 table is not populated by writes to its source table.
-- Without these, every search returns nothing and no error is raised.
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

-- Upstream's own map of renamed and redirected tags, so links survive renames.
-- A tag here is upstream's namespace for a link: a page filename where the type
-- has a page, a bare tag name where it does not. The page is the coarser half of
-- that mapping — trap and hazard tags share trapshazards.html — so a renderer
-- resolves its own tag to one of these rather than the reverse. to_tag repeats
-- tag except for the 36 redirects that land in another namespace.
CREATE TABLE tag_redirects (
  tag       TEXT NOT NULL,
  from_key  TEXT NOT NULL,
  to_tag    TEXT NOT NULL,
  to_key    TEXT NOT NULL,
  PRIMARY KEY (tag, from_key)
) STRICT;
`;

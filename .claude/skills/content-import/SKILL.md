---
name: content-import
description: Add or change an entity type in the 5etools ETL. Use when importing a new kind of content into content.db, promoting a Tier C type to a bespoke table, fixing _copy resolution, or handling class resource tables. Covers editions, identity keys, and lockfile verification.
---

# Adding an entity type to the ETL

Read [`docs/5etools-data.md`](../../../docs/5etools-data.md) for the tag grammar and the
`_copy` counts, and [`class-tables.md`](../../../docs/class-tables.md) for level tables.

## Before writing any loader

1. **Check the tier.** A Tier C type is a line in the `KINDS` of `load/entities.ts` plus
   a fixture, and those rows are searchable. Take the order below only when the sheet
   queries specific columns, which is what Tier A buys.
2. **Check for a `classTableGroups`-style structure** before writing a parser for prose.

## The loader contract

A loader is pure: it declares the files it needs and maps them to rows. Reading the
filesystem, opening the database, and inserting are the framework's job.

```ts
export const spells: Loader = {
  name: "spells",
  files: ["data/spells/spells-*.json"],   // vendor-relative paths or globs
  rows: (sources) => ({ spells: [...] }), // keyed by table, in declaration order
};
```

`build-db.ts` runs `LOADERS` in array order — which is insert order, and all the ordering
the framework has: a loader cannot read what an earlier one wrote. Everything runs in one
transaction against a per-process staging file, renamed into place only once every loader has
succeeded. A throw anywhere aborts the build and leaves the previous catalog in place.

## The order

```
1  packages/content/src/schema.ts       add the table, with the edition CHECK
2  packages/content/src/load/<type>.ts  map the parsed sources to rows
3  packages/content/src/load/index.ts   add it to LOADERS, in insert order
4  packages/content/src/load/<type>.test.ts   against tests/fixtures/
5  pnpm content:build && pnpm test
```

## Rules that are easy to get wrong

**Identity is `(name, source)`.** Never name alone. Sources collide across books. Count
the distinct keys against the row count before settling on one — a deity needs `pantheon`
and a feature needs its class and level, and both fail as a silent wrong answer rather
than as an error. `docs/data-model.md` holds the keys that are longer than two parts.

**Every Tier A row carries an edition** of `classic` or `one`. Derive it from the entry's
`edition` field where present, and from the source otherwise — `XPHB`, `XDMG`, `XMM`
are `one`. A missing edition on a Tier A row is a bug, not a null. Tier B and C hold
edition-less entries too, which is why `lookups` and `entities` allow it to be NULL.

**`_copy` is resolved for you**, at build time, across the declared set rather than one
file, failing the build on a cycle, an unheld or ambiguous parent, or an unimplemented
mode. A loader never sees a `_copy` and must not add handling for one — a new `_mod` mode
belongs in `mod.ts`, or `stat-block.ts` when it reads the creature and not one property.

**Declare files narrowly**, because that set is the parent pool: a glob wide enough to
catch `foundry-*.json` or `generated/` shadows real entries and makes a parent ambiguous.

**`_versions` is a different mechanism and is also resolved for you.** It expands one
entry into several rather than merging two into one, so a version arrives beside the one
it was written under — 112 across `races.json` and `feats.json`, so a loader counts more
than the file lists. A file neither mechanism leaves readable gets a `prepare` on its
`Loader`, running between them: only `races.json` does, to merge a subrace with its race.

**Unmapped class resource labels become generic counters**, not errors. Only about 80%
of resources come from `classTableGroups`; Battle Master superiority dice and similar
live in prose and cannot be extracted.

**Never write to `content.db` outside the ETL.** It is rebuilt wholesale and never
migrated. If you need to store something durable, it belongs in `characters.db` or
`homebrew.db`.

## Verifying

```bash
pnpm content:sync --verify   # vendor/ still matches content.lock.json
pnpm content:build
sqlite3 data/content.db "SELECT key, value FROM meta;"
sqlite3 data/content.db "SELECT edition, COUNT(*) FROM <table> GROUP BY edition;"
```

Both editions should be present. A single-edition result usually means the edition
derivation fell through to a default.

## Fixtures

CI does not fetch 109 MB. Add representative entries to `tests/fixtures/` for any new
type: one with a `_copy` chain, one of each edition, and one with tag-heavy text.

`load/index.test.ts` builds the whole `LOADERS` registry over that subset, so a loader
whose files are absent fails `readSources` under `pnpm test` — a new loader brings its
fixture or CI goes red. It is also the only test that sees insert order, since every
loader test passes its own loader alone.

---
name: content-import
description: Add or change an entity type in the 5etools ETL. Use when importing a new kind of content into content.db, promoting a Tier C type to a bespoke table, fixing _copy resolution, or handling class resource tables. Covers editions, identity keys, and lockfile verification.
---

# Adding an entity type to the ETL

Read [`docs/5etools-data.md`](../../../docs/5etools-data.md) first — it has the tag
grammar, the `_copy` counts per file, and the 21 class-resource labels.

## Before writing any loader

1. **Check the tier.** Does this need a bespoke table, or does Tier C already serve it?
   Tier C rows are searchable and resolve tags. Promote to Tier A only when the sheet
   queries specific columns.
2. **Check `_copy` density** in the source file. Spells, feats, optional features,
   conditions, and actions have none. Classes, items, backgrounds, and races do.
3. **Check for a `classTableGroups`-style structure** before writing a parser for prose.

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
2  packages/content/src/load/<type>.ts  read, resolve _copy, map rows
3  packages/content/src/load/index.ts   add it to LOADERS, in insert order
4  packages/content/src/load/<type>.test.ts   against tests/fixtures/
5  pnpm content:build && pnpm test
```

## Rules that are easy to get wrong

**Identity is `(name, source)`.** Never name alone. Sources collide across books.

**Every Tier A row carries an edition** of `classic` or `one`. Derive it from the entry's
`edition` field where present, and from the source otherwise — `XPHB`, `XDMG`, `XMM`
are `one`. A missing edition on a Tier A row is a bug, not a null. Tier B and C hold
edition-less entries too, which is why `lookups` and `entities` allow it to be NULL.

**Resolve `_copy` at build time, never at query time.** The `_meta.internalCopies` key
in each file names which entity types need it. A `_copy` block names a parent by
`(name, source)`; `_mod` describes changes to apply after copying.

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

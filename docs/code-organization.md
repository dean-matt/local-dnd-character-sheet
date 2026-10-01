# Code organization

[`architecture.md`](architecture.md) says which package a piece of code belongs in. This
says where it goes inside that package.

## One kind of thing per file

A file holds schemas, or pure helpers over them, or queries, or a route — not a mix. Each
kind changes for its own reason: a schema when the data's shape moves, a query when its
SQL does, a route when the API contract does. A file holding two kinds changes for both,
and a reader hunting one has to page past the other. A route's own query, request and
response schemas are part of the route; a record schema another file reads is a schema
and lives with the other schemas.

`packages/api` shows the split: `src/routes/` holds one route file per resource,
`src/db/queries/` the queries those routes call, and `src/db/` the Drizzle table
schemas, connections and migrations beneath them.

## Placement follows dependency

Code bound to one feature's form, rules or workflow lives beside that feature. Code bound
to none stays in the shared location. Shared code then never imports a
feature, and deleting a feature takes its private code with it rather than orphaning a
file in a shared folder.

`packages/web/src` shows the shared locations:

```
routes/             one file per route, plus the layout pieces around them
components/         UI any route may use: Card, Field, Modal, Popover, RulesText
components/blocks/  the block renderers PageBlocks draws for a character's pages
hooks/              TanStack Query hooks, one file per resource
lib/                plain functions, the one request builder api.ts among them
test/               helpers only tests import
```

A test sits beside the file it covers, as `X.test.tsx` next to `X.tsx`. The tree does not
yet hold to the placement rule everywhere: `lib/spellFacts.ts` has one reader,
`components/blocks/SpellsSection.tsx`, and belongs beside it. Nor does it hold to the next
rule: `AbilitiesSection.tsx`, `InventorySection.tsx` and `SpellsSection.tsx` in
`components/blocks/` each define several private components inline. Treat files like
these as ones to change, not as precedent.

## A private helper gets its own file

A helper component or hook that only one file uses still gets a file of its own, named
so it reads without its parent — `SpellSlotRow.tsx`, not `Row.tsx`. A name that
stands alone survives the day a second caller arrives, and a reader finds the helper by
filename instead of scrolling a host file for it.

## The public surface is `index.ts`

A library package's `exports` map names `src/index.ts`, and that file is the whole of
what other packages may import: `rules`, `dice`, `tags`, `character` and `catalog` work
this way. `content` exports only `./schema`, and `api` and `web` are applications that
export nothing.

Splitting a file never changes what the package exports. The new files re-export through
`index.ts` under the same names, so no other package edits an import and the surface knip
checks stays the same.

## Size is not the signal

A large file is fine when it is one cohesive thing, such as a schema catalog or a data
declaration like `packages/content/src/fixtures/declaration.ts`. Split a file when it
mixes concerns that change for different reasons, not to reach a line count: a split
along a number scatters one thing across files that must then change together.

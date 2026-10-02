# Code organization

[`architecture.md`](architecture.md) says which package a piece of code belongs in. This
says where it goes inside that package.

## One kind of thing per file

A file holds schemas, or pure helpers over them, or queries, or a route — not a mix. Each
kind changes for its own reason: a schema when the data's shape moves, a query when its
SQL does, a route when the API contract does. A file holding two kinds changes for both,
and a reader hunting one has to page past the other. A route's own query-string, request
and response schemas are part of the route; a record schema another file reads is a
schema and lives with the other schemas.

`packages/api` shows the split: `src/routes/` holds one route file per resource,
`src/db/queries/` the queries, and `src/db/` the Drizzle table schemas, connections and
the migration runner. The migrations themselves live in `drizzle/`.

## Placement follows dependency

Code bound to one feature's form, rules or workflow lives beside that feature. Code bound
to none stays in the shared location. Shared code then never imports a feature, and
deleting a feature takes its private code with it rather than orphaning a file in a
shared folder. A query hook binds to an API resource rather than a feature, so it stays
in `hooks/` however few files read it.

`packages/web/src` shows the shared locations:

```
./                       entry, router, theme and its toggle, loading and error states
routes/                  one file or folder per route, plus the layout pieces around them
  CharacterLayout/       a component with private parts is a folder named after it
    CharacterLayout.tsx  the one file code outside the folder imports
    CharacterSidebar.tsx a private part, read only inside the folder
    PrintSheet/          a private part with private parts of its own
components/              UI any route may use: Card, Field, Modal, Popover, RulesText
components/blocks/       the block renderers PageBlocks draws for a character's pages
hooks/                   TanStack Query hooks, one per file, and the query keys they share
lib/                     plain functions, the one request builder api.ts among them
test/                    helpers only tests import
```

A test sits beside the file it covers, as `X.test.tsx` next to `X.tsx`.

Some of the existing tree breaks a placement rule here. Single-reader helpers such as
`lib/spellFacts.ts` sit in shared folders, `api`'s `src/db/queries/contentFixture.ts` is a
test helper among the queries, and `api`'s `src/routes/errors.ts` is a shared schema module
among the routes. Existing placement is not precedent: new code follows these rules, and a
file earns the fix when a change splits or moves it. The next section has no such
exemption.

## One component, hook or concept per file

In `packages/web`, a `.tsx` file defines at most one component; one that defines a
component is named after it and exports only it and its props type. A file under `hooks/`
exports one hook, and a `lib/` file holds one concept, with the helpers and types only that
concept uses. Each file then changes for one reason, and a reader finds a component, hook
or concept by its filename. A constant or function a component file would export goes to
`lib/` or a file of its own instead: Vite's Fast Refresh hot-swaps only a file whose exports
are all components, and reloads the page for any other. `tests/web-file-shape.test.ts`
holds the component and hook rules; the concept rule is a judgment review makes.

A helper component or hook that only one file uses still gets a file of its own, named
so it reads without its parent — `SpellSlotRow.tsx`, not `Row.tsx`. A name that
stands alone survives the day a second caller arrives, and a reader finds the helper by
filename instead of scrolling a host file for it.

A component with private parts becomes a folder named after it, holding the component,
its test and those parts; a part with private parts of its own nests the same way. A leaf
component stays one file, and a part two components share sits beside both. Code outside a
folder imports only its namesake component, so a private part stays private and deleting
the component takes its parts along. No `index.ts` barrel re-exports a folder: an import
names the file, which keeps each export's readers visible to knip.
`tests/web-file-shape.test.ts` fails an import that reaches past a namesake, and a barrel.

A form reaches `FormShell` only through `lib/createForm.ts`, which binds the schema and
draft flow to it and returns the `useField` typed to that form. A route importing
`FormShell.tsx` directly gets a working form with no bound `useField`, and has to name the
form's type by hand. The namesake rule cannot hide the shell, so the same test fails any
import of it from outside its own folder except the one in `lib/createForm.ts`.

## The public surface is `index.ts`

A library package's `exports` map names `src/index.ts`, and that file is the whole of
what other packages may import: `rules`, `dice`, `tags`, `character` and `catalog` work
this way. `content` exports only `./schema`, and `api` and `web` are applications that
export nothing.

Splitting a file never changes what the package exports. The file the `exports` map names
re-exports the new files under the same names, so no other package edits an import and
the surface knip checks stays the same.

## Size is not the signal

A large file is fine when it is one cohesive thing, such as a schema catalog or a data
declaration like `packages/content/src/fixtures/declaration.ts`. Split a file when it
mixes concerns that change for different reasons, not to reach a line count: a split
along a number scatters one thing across files that must then change together.

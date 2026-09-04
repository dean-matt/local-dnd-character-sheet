# CLAUDE.md

A locally hosted D&D character sheet: React + Hono + SQLite, single user, no auth,
no deployment. Rules data comes from 5etools and is fetched, never committed.

This file is read at the start of every task, so every line here costs attention on
all future work. Detail that only some tasks need belongs in a skill or `docs/`.

## Architecture, decided

The package split and the three-database rule are the requested architecture.
The ladder below applies *within* them, not against them.

```
packages/shared    Zod schemas, tag parser, 5e rules math — used by api AND web
packages/dice      Dice notation parsing and rolling — depends on nothing
packages/content   ETL: sync + build -> content.db
packages/api       Hono + zod-openapi + Drizzle, 127.0.0.1:8787
packages/web       React + Vite + React Router + TanStack Query, 127.0.0.1:5173
```

| Database | Owner | Rule |
|---|---|---|
| `content.db` | generated | Read-only. Rebuilt wholesale, **never migrated**. Raw SQL, not Drizzle. |
| `characters.db` | the user | Migrated with Drizzle. Backed up. Precious. |
| `homebrew.db` | the user | Migrated with Drizzle. Backed up. Merged with the catalog at query time. |

Characters reference catalog rows by `(name, source)` — they never copy them.

## Commands

```bash
pnpm content:sync    # fetch upstream 5etools data at the pinned tag
pnpm content:build   # rebuild content.db from vendor/
pnpm dev             # api + web
pnpm db:studio       # visual database editor
pnpm check           # typecheck, lint, spell, deadcode, test — what CI runs
```

## Invariants

- **Never commit `vendor/5etools/` or any `.db` file.** The data is WotC's; see `NOTICE`.
- **Every content entity is keyed `(name, source)`**, never name alone. Tier A rows carry
  an `edition` of `classic` or `one`; Tier B and C allow NULL. Both editions ship for
  every class.
- **Derived character fields store computed *and* manual values plus an override flag.**
  A level-up recomputes without stomping a user's edit.
- **`roll_log` and `undo_log` are bounded** — 200 and 50 rows per character, pruned on
  insert. They are session affordances, not audit trails.
- **Unknown `{@tag}` values degrade to plain text.** Never throw on unrecognized markup.
- **Replacing an approach means deleting the old one in the same commit.** No "might be
  useful later" — `knip` will find it, but the commit should not have created it.

## Skills

| Skill | Use when |
|---|---|
| `content-import` | Adding or changing an entity type in the 5etools ETL |
| `add-endpoint` | Adding an API route, end to end |
| `5e-rules` | Any rules arithmetic — proficiency, DCs, slots, rests |
| `tag-render` | Adding or fixing support for a `{@tag}` |

Skills are indexed here so they compete for this file's budget. There is no cap on how
many exist; there is a cap on this file.

## Maintaining this document

Correcting a stale rule here is part of the change that made it wrong, in the **same
commit** — not a follow-up.

**Update it when the change** contradicts something written here, adds structure a
newcomer would otherwise have to discover, establishes a convention worth repeating, or
uncovered a trap that fails silently.

**Leave it alone when the change** only follows the rules already here, or would
duplicate a source of truth:

| Lives in | Never restate here |
|---|---|
| `packages/api/src/app.ts` and `/openapi.json` | endpoints, paths, schemas |
| `packages/*/src/db/*.ts` and `content/src/schema.ts` | table definitions |
| `package.json` | script bodies |
| `README.md` | prerequisites, setup, the command list |
| `CONTRIBUTING.md` | the reasoning behind every fence |
| `docs/` | 5etools data quirks, data model, architecture, reviving the project |
| `packages/*/*.md` | anything true of one package only, such as dice notation |
| `content.manifest.json` / `content.lock.json` | which upstream data is fetched |

**Write the edit** by verifying against the code first, replacing the stale sentence
rather than appending a correction beside it, and preferring to tighten an existing
bullet over adding a new one.

`tests/claude-md-shape.test.ts` caps this file at 150 lines. Past the cap, extract to a
skill — do not raise the cap.

## Code comments

Default to no comment. Add one only when it explains *why*. No history, no ticket or
issue numbers, no restating what the code does, no commented-out code, no marker
prefixes. Module-level docs are fine when they clarify inputs, outputs, or side effects
that the signature does not. Asserted by `tests/comment-policy.test.ts`.

## Coding disposition

The best code is the one never written. Before writing any, stop at the first rung that
holds: does this need to exist at all; does it already exist here; does the standard
library or the platform do it; does a dependency already installed; can it be one line.
Only then write the minimum that works.

The ladder runs *after* understanding the problem, never instead of it — the smallest
change in the wrong place is a second bug. Fix root causes, not the path a report names:
grep every caller and fix the shared function once. Prefer deleting to adding, boring to
clever, and fewest files. Question a complex request rather than implementing it twice.

Not lazy about: understanding the problem, input validation at trust boundaries, error
handling that prevents data loss, security, accessibility, or anything explicitly asked
for. Non-trivial logic leaves behind the smallest runnable check that fails if it breaks.

Where two approaches are the same size, take the edge-case-correct one. Where a
simplification cuts a real corner — a global lock, an O(n²) scan, a naive heuristic —
name the ceiling and the way out in a comment. If the explanation is longer than the
code, delete the explanation.

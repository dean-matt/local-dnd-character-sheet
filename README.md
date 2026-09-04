# local-dnd-character-sheet

A locally hosted website for creating, viewing, and interacting with D&D character
sheets. It runs entirely on your machine: a React frontend, a Hono API, and three SQLite
databases, with rules data read from the
[5etools](https://github.com/5etools-mirror-3/5etools-src) project. **Nothing is hosted
and no game content is redistributed here** — you fetch the rules data yourself, and the
app binds to `127.0.0.1` only.

## Prerequisites

- [Node.js](https://nodejs.org) 24 or newer — the version in `.node-version`
- [pnpm](https://pnpm.io) 11 or newer, most easily via `corepack enable`
- [typos](https://github.com/crate-ci/typos) for spellchecking — a standalone binary,
  not an npm package
  - macOS: `brew install typos-cli`
  - Windows: `scoop install typos`, or `cargo install typos-cli`
  - Linux: `cargo install typos-cli`, or your distribution's package
- `git`, which `pnpm content:sync` shells out to
- About 200 MB of disk for the fetched data and the generated catalog

Windows, macOS and Linux are all supported. `better-sqlite3` ships prebuilt binaries, so
no compiler toolchain is needed on any of them.

## Getting started

```bash
# One time
corepack enable
pnpm install
pnpm content:sync    # fetches ~109 MB of 5etools data — takes a few minutes
pnpm content:build   # builds data/content.db

# Every time
pnpm dev             # api on 127.0.0.1:8787, web on 127.0.0.1:5173
```

`pnpm content:sync` clones the upstream repository at the tag pinned in
`content.manifest.json`, copies the data into `vendor/5etools/`, and writes
`content.lock.json` with a hash of every file. That directory is gitignored: the rules
text is copyrighted by Wizards of the Coast and is never committed here. See
[`NOTICE`](NOTICE).

Both ports are pinned and the dev servers refuse to start if something else holds them —
free the port rather than letting it move, since the Vite proxy targets 8787 by name.

## Common commands

```bash
# Run
pnpm dev             # api + web together
pnpm build           # production build of every package

# Content
pnpm content:sync            # fetch the pinned upstream tag
pnpm content:sync --verify   # check vendor/ against content.lock.json
pnpm content:sync --tag v2.40.0   # move to a different upstream tag
pnpm content:build           # rebuild data/content.db from vendor/

# Database
pnpm db:studio       # visual editor for characters.db
pnpm db:generate     # generate a migration from schema changes
pnpm db:migrate      # apply pending migrations

# Check
pnpm check           # everything below, in order — what CI runs
pnpm typecheck       # tsc --build across the workspace
pnpm lint            # biome check
pnpm lint:fix        # biome check --write
pnpm spell           # typos
pnpm deadcode        # knip — unused files, exports, dependencies
pnpm test            # vitest — unit and repo fences
pnpm test:e2e        # playwright — boots the dev server itself
pnpm test:e2e:ui     # playwright in watch mode
```

## Project structure

```
packages/shared    Zod schemas, tag parser, 5e rules math — used by api and web
packages/dice      Dice notation parsing and rolling
packages/content   ETL that turns 5etools JSON into content.db
packages/api       Hono API, Drizzle schemas, OpenAPI spec
packages/web       React app
docs/              reference documentation
tests/             document shape and comment policy fences
vendor/5etools/    fetched upstream data, gitignored
data/              the three SQLite databases, gitignored
```

[`CLAUDE.md`](CLAUDE.md) carries the working agreement and is kept current with the tree.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `No content.lock.json` | The data has never been fetched. | `pnpm content:sync` |
| `vendor/ does not match content.lock.json` | An interrupted fetch, or files edited by hand. | `pnpm content:sync` |
| `pnpm check` fails with `typos not installed` | The spellchecker is a separate binary. | `brew install typos-cli` |
| `Error: Could not locate the bindings file` | `better-sqlite3` was built for a different Node major. | `pnpm rebuild better-sqlite3` |
| Port 5173 or 8787 already in use | An earlier dev server is still running. | macOS/Linux `lsof -ti tcp:8787 \| xargs kill`; Windows `npx kill-port 8787` |
| Empty search results after a rebuild | The catalog was rebuilt but never populated. | Check `SELECT * FROM meta` in `data/content.db` |

## Further reading

| File | What it is |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Working agreement for agents and contributors |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Why every fence in this repository exists, and how to work here |
| [`.claude/PONYTAIL.md`](.claude/PONYTAIL.md) | The coding disposition imported by `CLAUDE.md` |
| [`NOTICE`](NOTICE) | Licensing, and why game content is not committed |
| [`docs/architecture.md`](docs/architecture.md) | Request flow, the three databases, content tiers, deliberate absences |
| [`docs/data-model.md`](docs/data-model.md) | Character schema, overrides, references, resource counters |
| [`docs/5etools-data.md`](docs/5etools-data.md) | Editions, `_copy` inheritance, tag markup, class resource tables |
| [`docs/reviving.md`](docs/reviving.md) | Getting back to a running app after a long gap |

## Contributing

Work is tracked in GitHub issues, grouped into milestones that follow the build order.
Cut a branch from an issue with `gh issue develop <number> --checkout`.

Direct pushes to `main` are rejected — everything lands through a pull request. Commits
follow Conventional Commits, checked by `commitlint` on the commit-msg hook.

Full conventions and the reasoning behind them: [`CONTRIBUTING.md`](CONTRIBUTING.md).

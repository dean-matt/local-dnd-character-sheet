# Reviving this project

You have not touched this in a year. Here is the shortest path back to a running app.

## Check the toolchain

```bash
node --version    # must match .node-version
pnpm --version    # 11 or newer
```

If Node is wrong and you use a version manager, `nvm use` or `fnm use` reads
`.node-version` directly.

```bash
corepack enable   # once per machine, activates the pinned pnpm
pnpm install
```

The lockfile is committed, so this reproduces the exact dependency tree that last
worked. If `pnpm install` fails on a native module, `pnpm rebuild better-sqlite3` after
a Node major upgrade is usually enough.

`typos` is a separate binary, not an npm package: `brew install typos-cli`. Only
`pnpm check` needs it.

## Rebuild the catalog

`content.db` is gitignored and regenerable, so it will be missing:

```bash
pnpm content:sync --verify   # is vendor/ intact and matching the lockfile?
pnpm content:sync            # if not, refetch — needs network, takes a few minutes
pnpm content:build
```

Every build stamps `upstream_tag`, `built_at`, `built_by_commit`, and `node_version`
into the `meta` table, so you can always tell what produced a given database:

```bash
sqlite3 data/content.db "SELECT key, value FROM meta;"
```

## Check your data survived

`characters.db` and `homebrew.db` are gitignored and are **not** regenerable. If they
are missing, restore them from wherever you back them up. If they are present but the
schema has moved on:

```bash
pnpm db:migrate
```

## Run it

```bash
pnpm dev          # api on 8787, web on 5173
pnpm check        # confirm the fences still pass
```

## If you want to update the rules data

```bash
pnpm content:sync --tag v2.40.0   # rewrites content.lock.json and the manifest
pnpm content:build
pnpm check
```

Upstream ships roughly four tagged releases a month. There is no reason to track them
closely — update when you want new content, and read the lockfile diff to see what
changed.

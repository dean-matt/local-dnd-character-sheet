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

`typos` is a separate binary, not an npm package — `brew install typos-cli` on macOS,
`scoop install typos` on Windows. Only `pnpm check` needs it, and `pnpm spell` prints the
right command for your platform if it is missing.

## Rebuild the catalog

`content.db` is gitignored and regenerable, so it will be missing:

```bash
pnpm content:sync --verify   # is vendor/ intact and matching the lockfile?
pnpm content:sync            # if not, refetch — needs network, takes a few minutes
pnpm content:build
```

Every build stamps `upstream_tag`, `built_at`, `built_by_commit`, and `node_version`
into the `meta` table. `GET /catalog/meta` reads them back once the API is running —
see "Run it" below.

## Check your data survived

`characters.db` and `homebrew.db` are gitignored and are **not** regenerable. If they
are missing, restore them from wherever you back them up. If they are present but the
schema has moved on, `pnpm dev` migrates each automatically on startup. To bring them
current without starting anything else:

```bash
pnpm db:migrate
```

Both also back up each database before migrating it, to `data/backups/` as
`<characters|homebrew>-<timestamp>.db`, keeping the ten most recent per database. Restore
one by copying it back over the live file with the API stopped:

```bash
cp data/backups/characters-2026-09-18T12-00-00-000Z.db data/characters.db
rm -f data/characters.db-wal data/characters.db-shm
```

The `-wal` and `-shm` sidecars belong to the file you just replaced, not the backup, so
delete rather than keep them — SQLite recreates them from the restored file on next open.

## Get a deleted character back

Undo does not reach a deleted character. Deleting one first snapshots `characters.db` to
`data/backups/`, so the newest `characters-*.db` there still holds it. Copying that file
back would also lose every edit made since, so copy the one character's rows out of it
instead, with the API stopped:

```bash
backup=$(ls data/backups/characters-*.db | tail -1)
sqlite3 "$backup" 'SELECT id, name FROM characters'   # find the id
id=<the id>
sqlite3 data/characters.db <<SQL
ATTACH '$backup' AS backup;
BEGIN;
INSERT INTO characters SELECT * FROM backup.characters WHERE id = '$id';
INSERT INTO character_state SELECT * FROM backup.character_state WHERE character_id = '$id';
INSERT INTO character_pages SELECT * FROM backup.character_pages WHERE character_id = '$id';
INSERT INTO roll_log SELECT * FROM backup.roll_log WHERE character_id = '$id';
INSERT INTO undo_log SELECT * FROM backup.undo_log WHERE character_id = '$id';
COMMIT;
SQL
```

`SELECT *` holds because the snapshot shares the live file's schema. A backup taken before
a migration may not: list its columns with `.schema characters` and name them instead.
`data/backups/` keeps only the ten newest, so ten more deletes or restarts after a change
push the character out for good.

## Run it

```bash
pnpm dev          # api on 8787, web on 5173
pnpm check        # confirm the fences still pass
```

```bash
curl -s http://127.0.0.1:8787/catalog/meta | jq
```

## Re-enable the content workflow

GitHub disables a workflow carrying a `schedule:` after 60 days without repository
activity, so `content.yml` stopped running shortly after you did — the weekly corpus
check and the run a tag bump triggers both. Do this before the rules-data update below,
or that pull request merges with no corpus check: an absent check is not a red one, and
the merge gate reads it as green.

```bash
gh workflow enable content.yml
gh workflow run content.yml     # the first run answers for the whole gap
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

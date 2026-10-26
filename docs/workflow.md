# Working an issue here

The `github-sdlc` plugin carries the workflow: picking, building, reviewing, merging. This
file holds what is true of this repository alone, which the plugin's skills read from
`CLAUDE.md` and here.

## Before designing

Verify every count and shape the issue states against `vendor/`, and say which are wrong,
or that `vendor/` was not there to ask. An issue's numbers come from memory more often than
from the data.

## The worktree

A worktree needs `pnpm install --frozen-lockfile`, then symlinks to the untracked state the
main checkout holds: `vendor/5etools`, `data/content` and `.claude/settings.local.json`.

Never link `characters.db`: two agents writing it collide. Never fan a multi-file task out
across parallel subagents. Read in parallel; write one file at a time.

## Docs the change made stale

Correct them in the same commit as the change. A new `docs/` file needs a README row. Where
the issue is the last open one in an artboard's row of
[Retiring an artboard](mockup/README.md#retiring-an-artboard), delete that artboard as the
section says.

## The version

The merge raises the root `package.json` version, never the pull request, so a pull request
that edits it conflicts with every other.

## Protected paths

`.github/protected-paths.txt` lists what a merge waits on the user for. A change under one is
the user's to approve, however green the checks.

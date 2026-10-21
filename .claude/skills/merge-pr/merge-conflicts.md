# Resolving a merge conflict

Reached from [SKILL.md](SKILL.md) and [behind-branch-recovery.md](behind-branch-recovery.md)
wherever `git merge --no-edit origin/main` stops on a conflict in the issue's worktree.
`$n` is the pull request number.

## Settle what needs no judgment

Set a conflicted `version` line in `package.json` to `main`'s version and `git add
package.json` first. Then:

```bash
node scripts/resolve-conflicts.mjs "$n"
```

It takes both sides of every conflict that is table rows each side added to a Markdown file
outside the fence, `main`'s rows first, and stages the file. On `resolved`, `git commit
--no-edit`, push, and carry on where the caller left off.

On exit 1, `git merge --abort` and hand its output back as it printed it. It opens with the
pull request and the `main` commit the merge met, then lists each file left with the
conflicting hunks quoted and who resolves it:

- **the repo owner**, for a path `scripts/merge-gate.mjs` fences, which waits on the user
  the same way the fence condition does
- **the pull request's author**, for everything else — the session that built the branch,
  or a fresh `issue-to-pr` run on the pull request where that session is gone

## Resolving the rest

Whoever owns it merges `origin/main` into the branch in the issue's worktree, resolves each
file as below, runs `pnpm check`, and commits and pushes the merge. Never rebase.

| File | Resolution |
|---|---|
| `package.json` `version` | `main`'s version; the merge raises it again |
| A table in `README.md` or `docs/` | both rows, as the script does; an edited row takes the edit and keeps the other side's |
| A `docs/` file past its 200-line cap | keep both sides' text whole and split the file by subject, with a README row for the new file; never trim the other author's prose to fit |
| `CLAUDE.md` past its 150-line cap | keep both, then extract to a skill as `CLAUDE.md` says; fenced, so the repo owner |
| `pnpm-lock.yaml` | `git checkout --theirs pnpm-lock.yaml`, then `pnpm install` regenerates the branch's entries; never edit it by hand |
| Code | the author merges both intents; a test covers the merged behavior |

# Recovering a branch behind `main`

Reached from *Where the branch is behind* in [SKILL.md](SKILL.md), where the gate answers
`BEHIND`. `$n` is the pull request number.

## Update the branch on the server

```bash
gh api --method PUT "repos/{owner}/{repo}/pulls/$n/update-branch"
```

That merges `main` in on the server and leaves every pushed commit alone; never rebase or
force push instead. A 422 exits non-zero with its reason on stderr. `There are no new
commits on the base branch` means the branch is already current, so carry on to the wait.
Any other 422 is a conflict the update left untouched: go to *Raise the version again*,
which hands over any conflict past the `version` line, since resolving one is a code
decision this skill does not make.

## Wait out the stale window

The call answers 202 and queues the merge; until the head carries `main`, the checks
describe the old commit.

```bash
for _ in $(seq 8); do
  sleep 10
  gh pr view "$n" --json mergeable,mergeStateStatus \
    --jq 'select(.mergeable != "UNKNOWN" and .mergeStateStatus != "BEHIND")' | grep -q . &&
    { echo ready; break; }
done
```

Where a run ends without `ready`, read the state, then reinvoke:

```bash
gh pr view "$n" --json mergeStateStatus --jq .mergeStateStatus
```

Still `BEHIND` means the update never landed or `main` moved again: update again. Three
reinvocations go to the user, carrying that reading.

## Raise the version again

`main` raised the version while the branch waited. The same bump merges cleanly and the
updated head fails `pnpm version:check`; a different bump makes the update a 422 conflict on
the `version` line. In the issue's worktree, merge `main` locally and raise the version over
`main`'s as [`open-pr`](../open-pr/SKILL.md#the-version) says. Where
`.claude/worktrees/<issue>` is gone, open it as
[`issue-worktree`](../issue-worktree/SKILL.md#opening) says first.

```bash
git pull --ff-only && git fetch origin main
git merge --no-edit origin/main
```

A conflict anywhere but the `version` line goes to the user: `git merge --abort` and hand it
over. On that line alone, set it to `main`'s version, then `git add package.json && git commit
--no-edit`. Then:

```bash
npm version <minor|patch> --no-git-tag-version
pnpm version:check
git commit -am "chore(repo): raise the version over main's" && git push
```

Then wait out the stale window again.

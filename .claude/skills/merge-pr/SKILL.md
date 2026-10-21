---
name: merge-pr
description: Carry one reviewed local-dnd-character-sheet pull request to main — block on CI, run the merge gate, squash-merge, then delete the branch and its worktree, move the board to Done and leave the checkout on an up-to-date main. Use when asked to merge, land or ship a pull request here. Stops and names the condition where any part of the gate fails.
---

# Merging a pull request

[`issue-to-pr`](../issue-to-pr/SKILL.md) labels a pull request and stops; this lands it. Run
every command from the main checkout, since a worktree holds the branch the merge deletes —
except *Raise the version*, which works in the issue's worktree and returns after its push.

```bash
n=<pr>
gh pr view "$n" --json state,isDraft,url
b=$(gh pr view "$n" --json headRefName --jq .headRefName)
issue=$(gh pr view "$n" --json body --jq '.body | capture("Closes #(?<i>[0-9]+)").i')
```

The input is an open, non-draft pull request naming the issue it closes; anything else stops.

## Raise the version

The merge raises the root `package.json` version, so no other open pull request carries a
version line to redo. The ruleset requires every check green on a head carrying `main`'s tip,
so the bump is one more commit and one more CI run. Skip a `dependabot[bot]` pull request.

Work in the issue's worktree; where `.claude/worktrees/<issue>` is gone, open it on `$b` as
[`issue-worktree`](../issue-worktree/SKILL.md#opening) says first:

```bash
git pull --ff-only && git fetch origin main
git merge --no-edit origin/main
node scripts/version-bump.mjs "$n"
```

A conflict in the merge goes to [merge-conflicts.md](merge-conflicts.md). `version-bump.mjs`
prints `no bump` for a pull request that changes only prose or the mockup, and the new
version otherwise; for the version, install, commit and push:

```bash
pnpm install --frozen-lockfile
git commit package.json -m "chore(repo): raise the version to <version>" && git push
```

pnpm installs before running a script once `package.json` changes, so without the install
the pre-commit typecheck installs mid-hook. Where the hook still fails with `ENOENT`, install
and commit again. A rerun after the bump is pushed prints `no bump`.

## Block on the checks

```bash
node scripts/wait-checks.mjs "$n"
```

Run it with a 600000 ms tool timeout, straight after a push. It judges the local branch's
tip, never the head GitHub shows, so it waits until CI reports on the commit just pushed.
On exit 2, name what it printed and hand back. On exit 1, read
the failed step with `gh run view <id> --log-failed` and rerun the failed runs once.

```bash
gh pr checks "$n" --json bucket,link --jq '[.[] | select(.bucket == "fail" or .bucket == "cancel")
  | .link | capture("/runs/(?<id>[0-9]+)").id] | unique | .[]' |
  while read -r id; do gh run rerun "$id" --failed; done
sleep 30
node scripts/wait-checks.mjs "$n"
```

A rerun keeps the head and its red checks, so the sleep lets it show as pending first. On a
second exit 1, name the failed checks and hand back.

## The gate

```bash
node scripts/merge-gate.mjs "$n"
gh pr view "$n" --json labels --jq '[.labels[].name | select(startswith("review:"))] | join(",")'
```

The gate reads no label, so the second line does. Six conditions, each named where it fails:

- every check is green
- the review converged
- every thread carries a verdict
- no declined finding is `critical` or `warning`
- the diff reaches no fenced path, and no `package.json` changed a dependency
- the branch merges cleanly

Merge where it exits 0 and the label reads `review:approved`; otherwise name what failed
and stop. "The branch merges cleanly" goes to *Where the branch is behind* when its detail
line says behind. A fenced path, a blocking decline and any other label wait on the user:
name each and hand back, since only [`user-signoff`](../user-signoff/SKILL.md) clears them.
Read the pass body the script points at too — a finding no line anchors lives there, not on
a comment.

Two lines print beside *the review converged* and stop nothing: the distance line (how far
behind the tip the last pass sits, and the `git log` range that counted it — run that range
and weigh what it lists, since a pass short of the tip may be a fix answering it or code
nobody read) and the cap line (a waiver at the cap, an overage past it). The version
commit counts as one commit since the pass and needs no weighing. A `warn` line,
*the pull request is not linked to its issue*, stops nothing either. Name it to the user:
a dropped link needs a hand link from the pull request's Development box, and a body that
does not open with `Closes #<issue>` needs that line.
`scripts/merge-gate.mjs` holds the six conditions; `tests/merge-gate.test.ts` calls them.

## Where the branch is behind

Branch protection requires a head carrying the tip of `main`, so `gh pr merge` refuses a
pull request that sat while another merged, whatever the rest of the gate said.
[`behind-branch-recovery.md`](behind-branch-recovery.md) updates the branch from `main` on
the server and waits until GitHub has landed that merge. On its
`ready`, run its version step, *Block on the checks* and the gate again; a gate still saying GitHub is
computing mergeability is the queued merge landing, so ask again. Two round trips is the
ceiling — a third `BEHIND` means `main` moves faster than the checks run, and sequencing
that is the user's call.

## Merge, then clean up

Invoke [`issue-worktree`](../issue-worktree/SKILL.md) to close the worktree for `$issue`
first, or `gh` cannot delete the branch it holds. It refuses rather than discarding anything
uncommitted; stop on that refusal, and never force it.

```bash
gh pr merge "$n" --squash --delete-branch
git checkout main && git pull --ff-only
node scripts/unblock-issues.mjs "$issue"
```

`unblock-issues.mjs` clears `$issue` from every open issue's `## Blocked by` section, drops
the section and the `blocked` label where nothing else it names is open, and prints each
issue it unblocks or skips. A skip means the body changed between reads twice; rerun it once.

Invoke [`board-status`](../board-status/SKILL.md) to set `Done` on `$issue`'s card. A failure
here, rate limit included, does not undo the merge: report the card as not `Done` and carry on.

Then report the merge commit, the issue it closed, which issues it unblocked or skipped and that the checkout is on `main`.

## Rate limits

"API rate limit exceeded" means stop and wait for the reset; never retry in a loop.
`gh api rate_limit` does not show the secondary limit that expensive bursts trip, so
plenty left there proves nothing.

## What this skill will not do

**Resolve a conflict past the `version` line and added table rows.** [merge-conflicts.md](merge-conflicts.md) names its owner.

**Waive a condition.** A gate that argues itself open on the merge it is judging is not a
gate. Only `user-signoff`, run by the session holding the conversation, merges past one.

**Review.** [`audit-pr`](../audit-pr/SKILL.md) does that; this skill reads what that pass
left behind rather than forming an opinion of its own.

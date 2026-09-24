---
name: merge-pr
description: Carry one reviewed local-dnd-character-sheet pull request to main — block on CI, run the merge gate, squash-merge, then delete the branch and its worktree, move the board to Done and leave the checkout on an up-to-date main. Use when asked to merge, land or ship a pull request here. Stops and names the condition where any part of the gate fails.
---

# Merging a pull request

[`issue-to-pr`](../issue-to-pr/SKILL.md) labels a pull request and stops; this lands it. Run
every command from the main checkout — a worktree holds its branch, and the merge deletes it.

```bash
n=<pr>
gh pr view "$n" --json state,isDraft,url,headRefName
issue=$(gh pr view "$n" --json body --jq '.body | capture("Closes #(?<i>[0-9]+)").i')
```

The input is an open, non-draft pull request naming the issue it closes. Anything else
stops here.

## Block on the checks

```bash
gh pr checks "$n" --watch --fail-fast
```

`--watch` blocks until every check finishes, so a slow run outlives a single tool call —
reinvoke it rather than shortening the wait. Rerun a red run once, never twice: one rerun
covers a flaky runner, a second says the failure is the branch's.

```bash
gh pr checks "$n" --json bucket,link --jq '[.[] | select(.bucket == "fail" or .bucket == "cancel")
  | .link | capture("/runs/(?<id>[0-9]+)").id] | unique | .[]' |
  while read -r id; do gh run rerun "$id" --failed; done
sleep 30
gh pr checks "$n" --watch --fail-fast
```

The sleep covers the seconds before a rerun shows as pending; without it `--fail-fast` reads
the old conclusion and exits on it.

## The gate

```bash
node scripts/merge-gate.mjs "$n"
```

Six conditions, each named where it fails:

- every check is green
- the review converged
- every thread carries a verdict
- no declined finding is `critical` or `warning`
- the diff reaches no fenced path, and no `package.json` changed a dependency
- the branch merges cleanly

Merge where it exits 0; otherwise hand the user the condition it named and stop. Three
conditions route elsewhere first: "the branch merges cleanly" goes to *Where the branch is
behind* when its detail line says behind; "the diff reaches no fenced path" and "no
declined finding is critical or warning" go to their sign-off sections below. Read the
pass body the script points at too — a finding no line anchors lives there, not on a
comment.

Two lines print beside *the review converged* and stop nothing: the distance line (how far
behind the tip the last pass sits, and the `git log` range that counted it — run that range
and weigh what it lists, since a pass short of the tip may be a fix answering it or code
nobody read) and the cap line (a waiver at the cap, an overage past it).
`scripts/merge-gate.mjs` holds the six conditions; `tests/merge-gate.test.ts` calls them.

## Where the branch is behind

Branch protection requires a head carrying the tip of `main`, so `gh pr merge` refuses a
pull request that sat while another merged, whatever the rest of the gate said.
[`behind-branch-recovery.md`](behind-branch-recovery.md) updates the branch from `main` on
the server and waits out the two windows where the checks describe the wrong commit. On its
`ready`, run *Block on the checks* and the gate again; a gate still saying GitHub is
computing mergeability is the queued merge landing, so ask again. Two round trips is the ceiling — a third `BEHIND`
means `main` moves faster than the checks run, and sequencing that is the user's call.

## A fenced path, with the user's direct sign-off

"the diff reaches no fenced path" never gets easier to fail — `scripts/merge-gate.mjs`
prints `FAIL` for every caller, unchanged. The one sanctioned path past it: having heard
the sign-off directly rather than read a relayed report of it, the session holding the
conversation with the user may run *Merge, then clean up* for that pull request itself,
once every other condition holds. A subagent — including the one `auto-dev` dispatches —
takes no such latitude: it reports `FAIL` and stops, same as any other failing condition.
Every `gh` call authenticates as the same account regardless of driver; session identity
is the only thing this path checks, which is what distinguishes a witnessed sign-off from
a claimed one.

## A declined critical or warning, with the user's direct sign-off

"no declined finding is critical or warning" reads every declined thread, not just the
last pass, and a verdict reply can't be withdrawn — so a `critical` or `warning` finding
the user decides to accept anyway needs a record distinct from the decline itself. The one
sanctioned path past it: having heard the acceptance directly rather than read a relayed
report of it, the session holding the conversation posts an `**Accepted**` reply into that
finding's own thread, naming what was approved, then runs the gate again:

```bash
gh api "repos/{owner}/{repo}/pulls/$n/comments/<id>/replies" -f body='**Accepted** — <what was approved>'
```

`blockingDeclines` in `scripts/merge-gate.mjs` reads that reply and drops the finding from
the block. A subagent takes no such latitude: on this condition it reports `FAIL` and
stops, same as on any other failing condition.

## Merge, then clean up

Invoke [`issue-worktree`](../issue-worktree/SKILL.md) to close the worktree for `$issue`
first, or `gh` cannot delete the branch it holds. It refuses rather than discarding anything
uncommitted; stop on that refusal.

```bash
gh pr merge "$n" --squash --delete-branch
git checkout main && git pull --ff-only
node scripts/unblock-issues.mjs "$issue"
```

`unblock-issues.mjs` clears `$issue` from every open issue's `## Blocked by` section naming
it, dropping the section and the `blocked` label too where nothing else it names is still
open, and prints each issue it clears the label from.

Invoke [`board-status`](../board-status/SKILL.md) to set `Done` on `$issue`'s card. Setting
a board item already `Done` changes nothing. Then report the merge commit, the issue it
closed, which issues it unblocked, that the checkout is on `main`, and any sign-off taken
along the way — what was approved, heard directly rather than relayed.

## What this skill will not do

**Resolve a conflict.** It stops and hands the branch back.

**Waive a condition from inside a dispatched run.** A gate that argues itself open on the
merge it is judging is not a gate — see *A fenced path* and *A declined critical or
warning*, both with the user's direct sign-off, for the two exceptions, and both belong to
the session holding the conversation, never to a subagent. Widening
`scripts/merge-gate.mjs`'s fence rule itself is a separate, reviewed change against that
file, not something a single run decides for itself.

**Review.** [`audit-pr`](../audit-pr/SKILL.md) does that; this skill reads what that pass
left behind rather than forming an opinion of its own.

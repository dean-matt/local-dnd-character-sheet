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

Merge where it exits 0; otherwise hand the user the condition it named and stop — except
"the branch merges cleanly", whose detail line separates a conflict, a behind branch, and a
verdict GitHub has not computed yet, and "the diff reaches no fenced path", whose one
sanctioned exception *A fenced path, with the user's direct sign-off* names. A behind
branch goes to the next section rather than to the user. Read the pass body the script points at too: a finding no line anchors is
written there, not on a comment. Two lines print beside *the review converged* and stop
nothing. The distance line, every run: how far behind the tip the last pass sits, and the
`git log` range that counted it. A pass short of the tip may be a fix answering it or code
nobody read, so run that range, weigh what it lists, and say which in the report. The cap
line, at or past the cap: a waiver at it, an overage past it.
`scripts/merge-gate.mjs` holds the six and what each costs when wrong;
`tests/merge-gate.test.ts` calls them.

## Where the branch is behind

Branch protection requires a head carrying the tip of `main`, so `gh pr merge` refuses a
pull request that sat while another merged, whatever the rest of the gate said.
[`behind-branch-recovery.md`](behind-branch-recovery.md) updates the branch from `main` on
the server and waits out the two windows where the checks describe the wrong commit. On its
`ready`, run *Block on the checks* and the gate again; a gate still saying GitHub is
computing mergeability is the queued merge landing, so ask again. Two round trips is the ceiling — a third `BEHIND`
means `main` moves faster than the checks run, and sequencing that is the user's call.

## A fenced path, with the user's direct sign-off

"the diff reaches no fenced path" never gets easier to fail — nothing in
`scripts/merge-gate.mjs` changes, and it prints `FAIL` for every caller, same as today. The
one sanctioned path past it: having heard the sign-off directly rather than read a relayed
report of it, the session holding the conversation with the user may run *Merge, then clean
up* for that pull request itself, once every other condition holds. A subagent dispatched
to merge — including the one `auto-dev`'s step 4 sends — takes no such latitude: on this
condition it reports `FAIL` and stops, same as on any other failing condition. Every `gh`
call here authenticates as the same account whether a human or an agent drove it; being the
session that held the conversation is the only thing this path checks, because it is the
only thing that distinguishes a witnessed sign-off from a claimed one.

Where taken, name the sign-off in the report this skill closes with: what was approved,
and that it was heard directly rather than relayed.

## Merge, then clean up

Invoke [`issue-worktree`](../issue-worktree/SKILL.md) to close the worktree for `$issue`
first, or `gh` cannot delete the branch it holds. It refuses rather than discarding anything
uncommitted; stop on that refusal.

```bash
gh pr merge "$n" --squash --delete-branch
git checkout main && git pull --ff-only
```

Invoke [`board-status`](../board-status/SKILL.md) to set `Done` on `$issue`'s card. Setting
a board item already `Done` changes nothing. Then report the merge commit, the issue it
closed, and that the checkout is on `main`.

## What this skill will not do

**Resolve a conflict.** It stops and hands the branch back.

**Waive a condition from inside a dispatched run.** A gate that argues itself open on the
merge it is judging is not a gate — see *A fenced path, with the user's direct sign-off*
for the one exception, and it belongs to the session holding the conversation, never to a
subagent. Widening `scripts/merge-gate.mjs`'s fence rule itself is a separate, reviewed
change against that file, not something a single run decides for itself.

**Review.** [`audit-pr`](../audit-pr/SKILL.md) does that; this skill reads what that pass
left behind rather than forming an opinion of its own.

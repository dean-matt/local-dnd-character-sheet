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
node scripts/wait-checks.mjs "$n"
```

Run it with a 600000 ms tool timeout. On its exit 2, name what it printed and hand back.
On exit 1, rerun the failed runs once, never twice: one rerun covers a flaky runner, a
second says the failure is the branch's.

```bash
gh pr checks "$n" --json bucket,link --jq '[.[] | select(.bucket == "fail" or .bucket == "cancel")
  | .link | capture("/runs/(?<id>[0-9]+)").id] | unique | .[]' |
  while read -r id; do gh run rerun "$id" --failed; done
sleep 30
node scripts/wait-checks.mjs "$n"
```

The sleep lets the rerun show as pending before `wait-checks` reads it. A second exit 1 is
the branch's failure: name the failed checks and hand back.

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

Merge where it exits 0 and the label reads `review:approved`; otherwise hand the user the
condition it named and stop. "The branch merges cleanly" goes to *Where the branch is
behind* when its detail line says behind; a fenced path, a blocking decline and the label go
to *The user's direct sign-off*. Read the pass body the script points at too — a finding no
line anchors lives there, not on a comment.

Two lines print beside *the review converged* and stop nothing: the distance line (how far
behind the tip the last pass sits, and the `git log` range that counted it — run that range
and weigh what it lists, since a pass short of the tip may be a fix answering it or code
nobody read) and the cap line (a waiver at the cap, an overage past it). A `warn` line,
*the pull request is not linked to its issue*, stops nothing either. Name it to the user:
a dropped link needs a hand link from the pull request's Development box, and a body that
does not open with `Closes #<issue>` needs that line.
`scripts/merge-gate.mjs` holds the six conditions; `tests/merge-gate.test.ts` calls them.

## Where the branch is behind

Branch protection requires a head carrying the tip of `main`, so `gh pr merge` refuses a
pull request that sat while another merged, whatever the rest of the gate said.
[`behind-branch-recovery.md`](behind-branch-recovery.md) updates the branch from `main` on
the server and waits out the window where the checks describe the old commit. On its
`ready`, run *Block on the checks* and the gate again; a gate still saying GitHub is
computing mergeability is the queued merge landing, so ask again. Two round trips is the
ceiling — a third `BEHIND` means `main` moves faster than the checks run, and sequencing
that is the user's call.

## The user's direct sign-off

Three conditions pass only on the user's word heard directly in this conversation — never a
comment, a label or a report relaying it, which anyone could have written: every `gh` call
authenticates as the same account whatever the driver. The session holding the
conversation takes them; a subagent, including the one `auto-dev` dispatches, names the
condition and stops.

### A fenced path

"the diff reaches no fenced path" never gets easier to fail — `scripts/merge-gate.mjs`
prints `FAIL` for every caller, unchanged. A path under `docs/mockup/components/` waits on
the user's approval after viewing the mockup on the canvas; name that as the condition.
Once every other condition holds, the session that heard it runs *Merge, then clean up*.

### A declined critical or warning

"no declined finding is critical or warning" reads every declined thread, not just the
last pass, and a verdict reply can't be withdrawn — so a finding the user accepts anyway
needs a record distinct from the decline. The session that heard the acceptance posts an
`**Accepted**` reply into that finding's own thread, naming what was approved, then runs
the gate again:

```bash
gh api "repos/{owner}/{repo}/pulls/$n/comments/<id>/replies" -f body='**Accepted** — <what was approved>'
```

`blockingDeclines` in `scripts/merge-gate.mjs` reads that reply and drops the finding.

### A point waiting on the user

A label other than exactly `review:approved` means a pass left something for the user — a
point to confirm, a decline, a second issue. Never relabel on the answer: a dispatched run
would read the new label as an approval it never heard. Once the gate exits 0, the session
that heard the answer runs *Merge, then clean up* itself.

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
merge it is judging is not a gate. The three sign-off sections are the only exceptions, and
each belongs to the session holding the conversation, never to a subagent. Widening
`scripts/merge-gate.mjs`'s fence rule is a separate, reviewed change against that file.

**Review.** [`audit-pr`](../audit-pr/SKILL.md) does that; this skill reads what that pass
left behind rather than forming an opinion of its own.

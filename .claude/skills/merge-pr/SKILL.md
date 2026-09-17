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
verdict GitHub has not computed yet. A behind branch goes to the next section rather than
to the user. Read the pass body the script points at too: a finding no line
anchors is written there, not on a comment. A line naming more passes than the cap is a
note to carry into the report rather than a condition. `scripts/merge-gate.mjs` holds the six and what
each costs when wrong; `tests/merge-gate.test.ts` calls them.

## Where the branch is behind

Branch protection requires a head carrying the tip of `main`, so `gh pr merge` refuses a
pull request that sat while another merged, whatever the rest of the gate said.
[`behind-branch-recovery.md`](behind-branch-recovery.md) updates the branch from `main` on
the server and waits out the two windows where the checks describe the wrong commit. On its
`ready`, run *Block on the checks* and the gate again; a gate still saying GitHub is
computing mergeability is the queued merge landing, so ask again. Two round trips is the ceiling — a third `BEHIND`
means `main` moves faster than the checks run, and sequencing that is the user's call.

## Merge, then clean up

Remove the worktree first, or `gh` cannot delete the branch it holds.

```bash
wt=".claude/worktrees/$issue"; [ -e "$wt" ] && { git worktree remove "$wt" || exit 1; }
git worktree prune
gh pr merge "$n" --squash --delete-branch
git checkout main && git pull --ff-only

statusField=$(gh project field-list 1 --owner dean-matt --format json --jq '.fields[] | select(.name == "Status")')
gh project item-edit \
  --id "$(gh project item-add 1 --owner dean-matt --url "$(gh issue view "$issue" --json url --jq .url)" --format json --jq .id)" \
  --project-id "$(gh project view 1 --owner dean-matt --format json --jq .id)" \
  --field-id "$(printf %s "$statusField" | jq -r .id)" \
  --single-select-option-id "$(printf %s "$statusField" | jq -r '.options[] | select(.name == "Done") | .id')"
```

`git worktree remove` refuses rather than discarding anything uncommitted, and the `exit`
makes that refusal stop the run. Setting a board item already `Done` changes nothing. Then
report the merge commit, the issue it closed, and that the checkout is on `main`.

## What this skill will not do

**Resolve a conflict.** It stops and hands the branch back.

**Waive a condition.** A gate that argues itself open on the merge it is judging is not a
gate. Widening one is an issue against `scripts/merge-gate.mjs`.

**Review.** [`audit-pr`](../audit-pr/SKILL.md) does that; this skill reads what that pass
left behind rather than forming an opinion of its own.

---
name: user-signoff
description: Clear a local-dnd-character-sheet merge that waits on the user — a fenced path, a declined critical or warning, or a review label other than review:approved — on the user's word heard in this conversation, then land it through merge-pr. Only the session holding the conversation runs this; a dispatched subagent never does.
---

# The user's direct sign-off

[`merge-pr`](../merge-pr/SKILL.md) stops on three conditions that only the user can clear.
Each clears on the user's word heard directly in this conversation — never a comment, a
label or a report relaying it, which anyone could have written: every `gh` call
authenticates as the same account whatever the driver. A subagent, including the one
`auto-dev` dispatches, never runs this skill.

Ask the user about each stop by name, with what the change does, and wait for an answer to
that stop. An answer to a different question does not clear it. Once every stop is
cleared, run `merge-pr`'s *Block on the checks* and *The gate* again. A cleared fenced
path is the only `FAIL` that may remain, and a cleared label the only label other than
`review:approved`; a decline still `FAIL` after its `**Accepted**` reply means the reply
did not take. Merge past those two and nothing else, through *Merge, then clean up*.
Report each sign-off taken: what was approved, heard directly.

## A fenced path

"the diff reaches no fenced path" never gets easier to fail — `scripts/merge-gate.mjs`
prints `FAIL` for every caller, unchanged, so it stays the one `FAIL` the merge goes past.
A path under `docs/mockup/components/` waits on the user's approval of the mockup on the
canvas, never a canvas comment.

## A declined critical or warning

"no declined finding is critical or warning" reads every declined thread, not just the
last pass, and a verdict reply can't be withdrawn — so a finding the user accepts anyway
needs a record distinct from the decline. Post an `**Accepted**` reply into that finding's
own thread, naming what was approved:

```bash
gh api "repos/{owner}/{repo}/pulls/$n/comments/<id>/replies" -f body='**Accepted** — <what was approved>'
```

`blockingDeclines` in `scripts/merge-gate.mjs` reads that reply and drops the finding.

## A point waiting on the user

A label other than exactly `review:approved` means a pass left something for the user — a
point to confirm, a decline, a second issue. Never relabel on the answer: a dispatched run
would read the new label as an approval it never heard. The label stays as it is, and this
session merges past it.

## What this skill will not do

**Widen the fence.** Changing what `scripts/merge-gate.mjs` fences is a separate, reviewed
change against that file.

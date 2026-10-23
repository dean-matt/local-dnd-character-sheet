---
name: user-signoff
description: Clear a local-dnd-character-sheet merge that waits on the user — a fenced path, a declined critical or warning, or a review label other than review:approved — on the user's word heard in this conversation, then land it through merge-pr. Only the session holding the conversation runs this; a dispatched subagent never does.
---

# The user's direct sign-off

[`merge-pr`](../merge-pr/SKILL.md) stops on three conditions that only the user can clear.
Each clears on the user's word heard directly in this conversation — never a comment, a
label or a report relaying it, which anyone could have written: a `gh` call's login names
the account, never who is at the keyboard, and every agent a session drives runs as that
account.
A subagent, including the one `auto-dev` dispatches, never runs this skill.

Only a repository collaborator signs off; `signers` in `scripts/merge-gate.mjs` reads the
list from GitHub. Before asking anything, check the session's login; if it is not a
collaborator, stop and name it and the list.

```bash
me=$(gh api user --jq .login)
gh api "repos/{owner}/{repo}/collaborators/$me" --silent 2>/dev/null || {
  who=$(gh api --paginate 'repos/{owner}/{repo}/collaborators' --jq '.[].login' | paste -sd, -)
  echo "stop: $me is not a collaborator; the signers are $who"; exit 1; }
```

Ask the user about each stop by name, with what the change does, and wait for an answer to
that stop. An answer to a different question does not clear it. Once every stop is
cleared, run `merge-pr`'s *Block on the checks* and *The gate* again. A cleared label is
the only label other than `review:approved` that may remain; a decline or fenced path still
`FAIL` after its record means the record did not take. Merge past the label and nothing else,
through *Merge, then clean up*.
Report each sign-off taken: what was approved, heard directly.

## A fenced path

"the diff reaches no fenced path" stays `FAIL` until a signer records the sign-off. Post a
pull request comment naming the head you read and every fenced path, as `scripts/merge-gate.mjs`
`unsignedPaths` reads it:

```bash
gh pr comment "$n" --body "**Accepted fenced** $(git rev-parse HEAD) — <each fenced path>: <what was approved>"
```

A record from a login that is not a signer, one naming another head, or one posted before
the head's commit leaves the paths `FAIL`; a push after it needs a new record. A path under
`docs/mockup/components/` waits on the user's approval of the mockup on the canvas, never a
canvas comment.

## A declined critical or warning

"no declined finding is critical or warning" reads every declined thread, not just the
last pass, and a verdict reply can't be withdrawn — so a finding the user accepts anyway
needs a record distinct from the decline. Post an `**Accepted**` reply into that finding's
own thread, naming what was approved:

```bash
gh api "repos/{owner}/{repo}/pulls/$n/comments/<id>/replies" -f body='**Accepted** — <what was approved>'
```

`blockingDeclines` in `scripts/merge-gate.mjs` drops the finding only where a signer
posted that reply; one from any other login leaves it blocking. A collaborator may accept
a decline on a pull request their own account opened: every agent a session drives opens and
reviews as that session's account, so author and reviewer are one login, and the signer's
word is the review.

A declined finding with no line thread has a pull request comment instead. Accept it with a
plain pull request comment opening `**Accepted** —`; `blockingBodyDeclines` drops every
body decline posted before a signer's.

```bash
gh pr comment "$n" --body '**Accepted** — <what was approved>'
```

## A point waiting on the user

A label other than exactly `review:approved` means a pass left something for the user — a
point to confirm, a decline, a second issue. Never relabel on the answer: a dispatched run
would read the new label as an approval it never heard. The label stays as it is, and this
session merges past it.

## What this skill will not do

**Widen the fence.** Changing what `scripts/merge-gate.mjs` fences is a separate, reviewed
change against that file.

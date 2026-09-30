---
name: open-pr
description: Open the pull request for one local-dnd-character-sheet issue and write its body — `gh pr create`, `Closes #<issue>` first line, what changed, and the verification that ran. Use from `issue-to-pr` once a branch is pushed and ready for review; cite it, rather than restate it, from anywhere else that reads or rewrites a pull request body.
---

# Opening a pull request

Open it with `gh pr create`, body written to the format below. This starts CI; the pushes
before it started nothing. A dispatched run whose diff changes `docs/mockup/components/`
adds `--draft`: [Changing a mockup](../../../docs/mockup/README.md#changing-a-mockup) marks
it ready once the canvas carries the change.

## The pull request body

`Closes #<issue>` on the first line. Then what the change does and, for anything a reviewer
would otherwise derive, the entry in the data that decided it as `Name` (SOURCE). Close
with the verification: "`pnpm check` is green" is the floor, so say what ran against the
real corpus and what came out. A mockup change adds its `Canvas:` line, naming the link
and the version the files were published as.

## What this skill will not do

**Decide what to write.** The issue and the diff say what changed; this skill says only how
to shape it into a first line, a body and a verification line that `merge-pr` can parse
back out.

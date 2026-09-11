---
name: work-issue
description: Take one issue from open to a reviewed pull request. Use when asked to work, build, implement or pick up an issue, or to decide which issue is next. Runs the whole sequence — branch, implement, prose pass, pull request, self-review — and stops before merging.
---

# Working an issue

Every stage below is written down somewhere already. This is the order, and the
stages that get skipped when nobody asks for them: the prose pass, and reviewing
your own pull request before handing it over.

Read [`CONTRIBUTING.md`](../../../CONTRIBUTING.md) first. It holds the reasoning
behind the branch, commit and pull request rules, and this skill does not repeat
them.

## Choosing, when no issue is named

Milestones are the build order, so the live milestone is the one with open issues
whose predecessors are closed. Within it, prefer an issue that builds on code that
just landed over one that starts a new area. Say which you picked and why before
starting, so a wrong pick costs a sentence rather than a branch.

`gh issue list` reports a `blocked` label. Check what blocks it is still true — a
blocker that closed this morning leaves the label behind.

## The sequence

1. **Read the issue in full**, acceptance criteria and **Out of scope** both. Out
   of scope is a fence, not a suggestion.
2. **Check the data before designing against it.** Where the issue states counts or
   shapes, verify them against `vendor/` — they are written from an earlier read and
   an issue can be wrong about its own corpus. Say so when one is.
3. **Branch** with `gh issue develop <n> --name <type>/<n>-<slug> --checkout`.
4. **Invoke the skill the work names**, if `CLAUDE.md` indexes one for it.
5. **Implement**, stopping at the first rung of the ladder in `CLAUDE.md` that
   holds. Tests ride with the code they cover.
6. **`pnpm check`** until green. Never push past a failure with a note about it.
7. **Correct the docs the change made stale**, in the same commit. `docs/` and
   `CLAUDE.md` both have caps — past one, replace a sentence rather than append.
8. **Prose pass** with `writing-clearly-and-concisely` over the commit message, the
   pull request body, and any prose the change touched. Comments included.
9. **Commit and push.** One concern per commit.
10. **Open the pull request** with `gh pr create`, body linking the issue.
11. **Review it** with `/code-review <pr>`, then apply what survives.
12. **Stop.** Report what landed and what the review found. The merge is the user's
    call, every time.

## The pull request body

`Closes #<issue>` on the first line. Then what the change does and, for anything a
reviewer would otherwise have to derive, the entry in the data that decided it —
name it by `Name` (SOURCE). A design choice with a witness reads as a finding; the
same choice without one reads as a preference.

Close with how it was verified. "`pnpm check` is green" is the floor, not the
answer: say what was run against the real corpus and what came out.

## What this skill will not do

**Merge.** Not with an approval on the pull request, not when the review found
nothing, not when the change is trivial. Report and wait.

**Widen the issue.** A second bug found on the way is a second issue. File it or
name it in the report; do not fix it in this branch.

**Raise a cap to fit.** The line caps on `CLAUDE.md`, `docs/` and a skill are the
fence, and hitting one means extracting, not editing the number.

## After the merge, once the user calls it

`gh pr merge <n> --squash --delete-branch`, which also leaves you on `main`. A
branch that never became a pull request is reaped by nothing — delete it by hand.

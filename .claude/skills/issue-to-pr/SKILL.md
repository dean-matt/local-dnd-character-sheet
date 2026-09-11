---
name: issue-to-pr
description: Take one issue in this repository from open to a reviewed pull request — branch, implement, pnpm check, prose pass, pull request, then review the pull request and the fixes made to it. Use when asked to work, build, implement or pick up an issue, or to decide which issue is next. Defers to CONTRIBUTING.md, and stops before merging.
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
12. **Review the fixes** with `/code-review <before>..<after>`, and keep going until a
    pass is clean. Not a judgment call — the fixes are the least-reviewed code in the
    branch, and a fix that covers one instance of a class rather than the class is
    the way this goes wrong.
13. **Stop.** Report what landed and what each review found. The merge is the user's
    call, every time.

## The pull request body

`Closes #<issue>` on the first line. Then what the change does and, for anything a
reviewer would otherwise have to derive, the entry in the data that decided it —
name it by `Name` (SOURCE). A design choice with a witness reads as a finding; the
same choice without one reads as a preference.

Close with how it was verified. "`pnpm check` is green" is the floor, not the
answer: say what was run against the real corpus and what came out.

## Counts are evidence, so source them

A number in a comment, a commit message or a pull request body is the reason the
code is shaped the way it is, and a reader acts on it. Cite one only from a
measurement made in this session, and re-run that measurement after any change that
could move it — a figure quoted from earlier in the conversation is a figure nobody
checked. It is the same argument `CONTRIBUTING.md` makes about a hand-edited
fixture: an assertion against a number with no source.

Two ways this goes wrong, both cheap to prevent and invisible once written. Quoting
a count taken before the fix, as though it described the state after. And reading
the neighbouring row of your own output — the population that shares a name with
the one you meant.

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

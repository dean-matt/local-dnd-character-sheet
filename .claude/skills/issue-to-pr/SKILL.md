---
name: issue-to-pr
description: Take one local-dnd-character-sheet issue from open to a reviewed pull request — gh issue develop, implement, pnpm check, prose pass, pull request, then review it and re-review while a pass still turns up a defect. Use when asked to work, build, implement or pick up an issue in this repository, or to decide which issue here is next. Follows this repository's CONTRIBUTING.md and stops before merging.
---

# Issue to pull request

Read `CONTRIBUTING.md` first; it holds the reasoning these steps assume.

## Choosing, when no issue is named

Pick one, say which and why in a sentence, and start. Naming it first makes a wrong
pick cost a sentence rather than a branch.

Milestones are numbered and are the build order, so the live one is the
lowest-numbered with any issue open. Take from it alone: an issue carrying no
milestone is backlog, however small it looks, and waits for the user to name it.

Within the live milestone, in order:

1. Drop anything `blocked` whose blocker is still open. Read the blocker rather than
   the label, which stays behind when the blocker closes.
2. Leave an audit of the milestone's own work until last. It reads code that keeps
   moving until the milestone's final issue lands.
3. Prefer the issue that builds on what just merged, while that code is fresh.

When the audit is all that remains, take it: last is where it belongs. When the
milestone has nothing open, the next one is live; when everything open in it is
blocked, say so and stop rather than starting the milestone below.

## The sequence

1. **Read the issue in full**, acceptance criteria and **Out of scope** both. Out of
   scope is a fence, not a suggestion.
2. **Where the issue states counts or shapes, verify them against `vendor/`** before
   designing against them: an issue states them from an earlier read and can be wrong
   about its own corpus. Say which are wrong, or that `vendor/` was not there to ask.
3. **Branch** with `gh issue develop <n> --name <type>/<n>-<slug> --checkout`.
4. **Invoke the skill the work names**, where `CLAUDE.md` indexes one.
5. **Implement**, stopping at the first rung of the ladder in `CLAUDE.md` that holds.
   Tests ride with the code they cover.
6. **Correct the docs the change made stale**, in the same commit. `docs/` and
   `CLAUDE.md` both have caps: past one, replace a sentence rather than append.
7. **Prose pass** with `writing-clearly-and-concisely` over the commit message, the
   pull request body, and every comment the change touched.
8. **`pnpm check`, then commit and push**, once per concern the issue carries. Never
   push past a failure with a note about it, and run it after steps 6 and 7:
   pre-commit runs neither the tests nor the caps.
9. **Open the pull request** with `gh pr create`, body linking the issue. This is what
   starts CI; the pushes before it started nothing.
10. **Review it** with `/code-review <pr>`, then check `git branch --show-current` and
    return to your branch — a review leaves the tree where it checked out, and a
    detached HEAD commits onto nothing with the branch-name hook silent.
11. **Apply what survives**, `pnpm check`, prose pass everything the fixes touched,
    commit and push, and bring the pull request body back in line. Fixes left in the
    working tree leave the pull request holding the code the review rejected.
12. **Repeat 10 and 11 while a pass returns something that would fail at runtime,
    mislead a reader, or contradict the repo.** Stop otherwise, and stop at the third
    pass regardless: report what the last one found and let the user weigh it. A pass
    returning only preferences has stopped paying. A red CI goes round the same loop —
    Windows and the end-to-end tests run nowhere else.
13. **Stop.** Report what landed, what each review found, and CI on the last push.
    The merge is the user's call, every time.

## The pull request body

`Closes #<issue>` on the first line. Then what the change does and, for anything a
reviewer would otherwise derive, the entry in the data that decided it, named as
`Name` (SOURCE).

Close with the verification. "`pnpm check` is green" is the floor: say what ran
against the real corpus and what came out.

## Counts are evidence, so source them

A reader acts on a number in a comment, a commit message or a pull request body,
because it is the reason the code is shaped the way it is. Cite one only from a
measurement made this session, and re-run it after any change that could move it.
`CONTRIBUTING.md` makes the same argument about a hand-edited fixture.

## What this skill will not do

**Merge.** Report and wait, whatever the review found and however small the change.

**Widen the issue.** A second bug found on the way is a second issue. File it or name
it in the report; leave it out of this branch.

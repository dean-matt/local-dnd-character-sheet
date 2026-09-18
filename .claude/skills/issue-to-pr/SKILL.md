---
name: issue-to-pr
description: Take one local-dnd-character-sheet issue from open to a reviewed pull request — gh issue develop, implement, pnpm check, prose pass, pull request, then review it and re-review while a pass still turns up a defect. Use when asked to work, build, implement or pick up an issue in this repository, or to decide which issue here is next. Follows this repository's CONTRIBUTING.md and stops before merging.
---

# Issue to pull request

Read `CONTRIBUTING.md` first.

## Choosing, when no issue is named

Invoke [`pick-issue`](../pick-issue/SKILL.md). It returns the issue to take, or the reason
it took none — stop there.

## The sequence

1. **Invoke [`board-status`](../board-status/SKILL.md) to set `In Progress`.** Its own
   workflow waits for the pull request.
2. **Read the issue in full**, acceptance criteria and **Out of scope** both. Out of scope
   is a fence.
3. **Verify every count and shape the issue states against `vendor/`** before designing
   against it. Say which are wrong, or that `vendor/` was not there to ask.
4. **Invoke [`issue-worktree`](../issue-worktree/SKILL.md) to open the worktree**, then
   `cd` into it. Run every later step from inside; step 12 closes it.
5. **Invoke the skill the change needs**, where `CLAUDE.md` indexes one.
6. **Implement**, stopping at the first rung of `CLAUDE.md`'s ladder that holds. Tests ride
   with the code they cover, and every command written into a skill is run before it lands.
   Work the worktree alone: never fan a multi-file task out across parallel subagents. A
   `fork` inherits this whole conversation, siblings included, and can mistake it for its
   own plan; this session can just as easily lose track of what it already dispatched after
   a compaction and send a second wave. Read files in parallel if that helps, but write them
   one at a time — and on any resume, run `ListAgents` against what was actually dispatched
   before sending more.
7. **Correct the docs the change made stale**, in the same commit. Past a `docs/` or
   `CLAUDE.md` cap, replace a sentence rather than append; a new `docs/` file needs a
   README row.
8. **Prose pass** with `writing-clearly-and-concisely` over every piece of prose the change
   wrote — commit message, comments, `docs/`, a skill, `CLAUDE.md`. A skill says what to
   do; keep a reason only where losing it lets the next agent delete a fence or walk into a
   failure that passes silently.
9. **`pnpm check`, then commit and push**, once per concern the issue carries. Run it after
   steps 6 and 7 — pre-commit runs neither the tests nor the caps. Never push past a
   failure with a note about it.
10. **Invoke [`open-pr`](../open-pr/SKILL.md)**. It opens the pull request and writes its
    body in the format it defines.
11. **Invoke [`converge-review`](../converge-review/SKILL.md)** with the pull request
    number and nothing else. It dispatches the review, posts and applies each pass, and
    labels the pull request `review:approved` or `review:changes-requested`. It returns
    that label, what each pass found, and what `gh pr checks` says.
12. **Invoke [`issue-worktree`](../issue-worktree/SKILL.md) to close the worktree.** The
    branch and the pull request stand.

    Report what `converge-review` returned. A run still in flight is reported in flight
    rather than waited on; a red run is the user's to weigh.

## What this skill will not do

**Merge.** Report and wait, whatever the review found and however small the change.

**Widen the issue.** A second bug found on the way is a second issue: file it or name it
in the report, and leave it out of this branch. `gh issue create` leaves that issue off the
board, so put it there with [`board-status`](../board-status/SKILL.md). It lands unranked
and without a milestone, which [`pick-issue`](../pick-issue/SKILL.md) reads as backlog
until the user ranks it under a milestone.

**Compete with a second driver.** A commit this run did not make, or an edit it cannot
account for, means a second driver — a duplicate dispatch, or the user resuming this same
agent by hand — now holds the same worktree. Stop, name what changed and who could have
written it, and report to the user rather than reconcile it alone.

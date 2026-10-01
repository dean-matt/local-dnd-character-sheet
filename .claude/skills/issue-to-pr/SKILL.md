---
name: issue-to-pr
description: Take one local-dnd-character-sheet issue from open to a reviewed pull request — gh issue develop, implement, pnpm check, prose pass, pull request, then review it and re-review while a pass still turns up a defect. Use when asked to work, build, implement or pick up an issue in this repository, or to decide which issue here is next. Follows this repository's CONTRIBUTING.md and stops before merging.
---

# Issue to pull request

Read `CONTRIBUTING.md` first.

Resuming after any gap — a compaction, a hand-off — run `ListAgents` and check it against
what this session already dispatched before doing anything else. A fork inherits this
whole conversation, siblings included, and can mistake a dispatch message for its own plan;
this session can just as easily lose track of what it already sent and repeat itself.

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
   `cd` into it. Run every later step from inside; step 13 closes it.
5. **Invoke the skill the change needs**, where `CLAUDE.md` indexes one.
6. **Implement**, stopping at the first rung of `CLAUDE.md`'s ladder that holds. Tests ride
   with the code they cover, and every command written into a skill is run before it lands.
   Work the worktree alone: never fan a multi-file task out across parallel subagents. Read
   files in parallel if that helps, but write them one at a time.
7. **Correct the docs the change made stale**, in the same commit. Past a `docs/` or
   `CLAUDE.md` cap, replace a sentence rather than append; a new `docs/` file needs a
   README row. Where the issue is the last open one in an artboard's row of
   [Retiring an artboard](../../../docs/mockup/README.md#retiring-an-artboard), delete
   that artboard as the section says, and step 12 publishes the deletion.
8. **Prose pass** with `writing-clearly-and-concisely` over every piece of prose the change
   wrote — commit message, comments, `docs/`, a skill, `CLAUDE.md`. A skill says what to
   do; keep a reason only where losing it lets the next agent delete a fence or walk into a
   failure that passes silently.
9. **`pnpm check`, then commit and push**, once per concern the issue carries. Run it after
   steps 6 and 7 — pre-commit runs neither the tests nor the caps. Never push past a
   failure with a note about it.
10. **Invoke [`open-pr`](../open-pr/SKILL.md)**. It opens the pull request and writes its
    body in the format it defines, as a draft where the diff changes
    `docs/mockup/components/`.
11. **Invoke [`converge-review`](../converge-review/SKILL.md)** with the pull request
    number and nothing else. It dispatches the review, posts and applies each pass, and
    labels the pull request `review:approved` or `review:changes-requested`. It returns
    that label and what each pass found.
12. **Publish a mockup change, wait on CI, then run the gate.** Where the diff changes
    `docs/mockup/components/`, the session holding the conversation publishes every
    changed file as [Changing a mockup](../../../docs/mockup/README.md#changing-a-mockup)
    says; a dispatched run reports them instead.


    ```bash
    node scripts/wait-checks.mjs <pr>
    node scripts/merge-gate.mjs <pr>
    ```

    Run `wait-checks` with a 600000 ms tool timeout. On its exit 2, note what it printed
    and skip the gate. On any other exit, run the gate and note its exit, each `FAIL` and
    `warn` line, and any failed check. Both paths go on to step 13.
13. **Invoke [`issue-worktree`](../issue-worktree/SKILL.md) to close the worktree.** The
    branch and the pull request stand. Report the pull request, the label and what step 12
    noted. Under "waiting on the user", list only real holds — each changed mockup file, a
    declined finding, an issue this run filed — or say "nothing". Never list the merge:
    `merge-gate` decides it.

## What this skill will not do

**Merge.** Stop at the report, whatever the review found and however small the change.
Stopping hands the merge to [`merge-pr`](../merge-pr/SKILL.md), not to the user; only its
sign-off sections ask the user for one.

**Widen the issue.** A second bug found on the way is a second issue: file it or name it
in the report, and leave it out of this branch. `gh issue create` leaves that issue off the
board, so put it there with [`board-status`](../board-status/SKILL.md). It lands unranked
and without a milestone, which [`pick-issue`](../pick-issue/SKILL.md) reads as backlog
until the user ranks it under a milestone.

**Compete with a second driver.** A commit this run did not make, or an edit it cannot
account for, means a second driver — a duplicate dispatch, or the user resuming this same
agent by hand — now holds the same worktree. Stop, name what changed and who could have
written it, and report to the user rather than reconcile it alone.

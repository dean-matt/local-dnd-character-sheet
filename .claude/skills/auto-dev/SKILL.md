---
name: auto-dev
description: Work the local-dnd-character-sheet board issue after issue, from open to merged — dispatch issue-to-pr then merge-pr per issue in fresh subagents, and stop on the first issue that does not merge. Use when asked to work through the board, clear the backlog, or keep going until a count or a deadline.
---

# Driving the board

[`issue-to-pr`](../issue-to-pr/SKILL.md) takes one issue to a reviewed pull request and
[`merge-pr`](../merge-pr/SKILL.md) takes that pull request to `main`. This calls them in
turn and decides only when to stop — every judgment about this codebase belongs to the two
skills it dispatches.

Run every command from the main checkout. Each dispatched skill makes and removes its own
worktree.

## The limits, before the first dispatch

Take from the caller a count of issues to merge, a wall-clock deadline, both, or neither.
Wall clock is the budget a skill can measure, so it is what a budget means here. Print the
deadline once and carry the number it gives:

```bash
echo $(( $(date +%s) + <seconds> ))
```

With neither, the run ends when the board query returns nothing. Say so before the first
dispatch, so an unbounded run is the caller's choice rather than a surprise.

## Per issue

**1. Read the limits.** Stop where the run has merged the caller's count, or where the
deadline has passed:

```bash
if [ "$(date +%s)" -ge <deadline> ]; then echo past; else echo within; fi
```

Read them here and nowhere else. A run that abandons an issue mid-flight leaves a branch
and a pull request nobody asked for.

**2. Build.** Dispatch a fresh subagent whose prompt names
[`issue-to-pr`](../issue-to-pr/SKILL.md) and no issue. That skill's *Choosing, when no
issue is named* picks; running its board query here would give the board two readers that
can disagree. Ask for the issue it took, the pull request number, whatever waits on the
user, and whether its review pass ran in a subagent of its own.

Stop where that pass ran anywhere else. `issue-to-pr` sends its review to a subagent that
did not write the code, and a review one agent both writes and reads still earns
`review:approved` — merging on that defeats the gate silently. The claim is the build
subagent's own and GitHub cannot tell a subagent's review from a self-written one, so this
catches a dispatch that failed, not one an agent skipped and did not say so.

A report naming no issue stops the run. Report the reason it named rather than calling the
board empty — `issue-to-pr`'s query stops the same way on a truncated board and on a
failed `gh` call.

A report naming an issue but no pull request means `issue-to-pr` stopped on the way — a
`blocked` condition that still holds, or a `pnpm check` it refused to push past. Stop and
report the condition. Looping back either retakes that issue forever or skips it.

**3. Read the verdict.**

```bash
gh pr view <pr> --json labels --jq '[.labels[].name] | any(. == "review:approved")'
```

A `false` stops the run. That label is `issue-to-pr` saying nothing waits on the user, and
dispatching `merge-pr` without it spends a whole CI watch before the gate refuses the same
pull request.

**4. Merge.** Dispatch a second fresh subagent, naming
[`merge-pr`](../merge-pr/SKILL.md) and the pull request number. Fresh, because the agent
that wrote the code is the worst reader of a gate judging its own work. Stop where it
names a condition instead of a merge commit.

**5. Count the merge and loop.** `gh pr view <pr> --json state,mergeCommit` settles
whether it merged, rather than the report of the subagent that merged it — the standard
the rest of this skill holds. The count is of merges, not of attempts.

## The report

One line per issue attempted, in the order taken:

- `#<n>` **merged** — the pull request, the merge commit, and anything `issue-to-pr` left
  waiting on the user, such as a second issue it filed
- `#<n>` **stopped** — the pull request, and the condition, quoted from the skill that
  named it

Close with why the run ended and what the user now holds. A stop leaves the branch and the
pull request standing; `issue-to-pr` removes its own worktree whichever label it leaves, so
one still under `.claude/worktrees/` means a run died before that step. `merge-pr` leaves
the checkout on an up-to-date `main` wherever one merged.

## What this skill will not do

**Resolve what stopped it, or skip past it.** A declined finding, a red check and a
merge-gate condition are each the user's to weigh. The board is ordered, so an issue that
stops the run is the issue the user is deciding about, and taking the next one buries that
decision under a second pull request.

**Rerank the board.** The order is the user's.

**Start itself.** No cron, no workflow trigger, nothing that begins a run without a person
asking. Nobody reads an unwatched run, and it merges to `main` all the same.

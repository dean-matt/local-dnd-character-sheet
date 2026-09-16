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
Wall clock is the budget a skill can measure, so it is what a budget means here. Record
the deadline once:

```bash
end=$(( $(date +%s) + <seconds> ))
```

With neither, the run ends when the board query returns nothing. Say so before the first
dispatch, so an unbounded run is the caller's choice rather than a surprise.

Check both limits before dispatching an issue, never during one. A run that abandons an
issue mid-flight leaves a branch and a pull request nobody asked for.

## Per issue

**1. Build.** Dispatch a fresh subagent whose prompt names
[`issue-to-pr`](../issue-to-pr/SKILL.md) and no issue. That skill's *Choosing, when no
issue is named* picks; running its board query here would give the board two readers that
can disagree. Ask for the issue it took, the pull request number, the label it left, and
whatever waits on the user.

Dispatch a subagent that can itself dispatch one: `issue-to-pr` sends its review pass to a
subagent that did not write the code, and where that nesting fails the pass approves its
own work.

A report naming no issue means the board holds nothing ranked and open: stop.

**2. Read the verdict.**

```bash
gh pr view <pr> --json labels --jq '[.labels[].name]'
```

Anything but `review:approved` stops the run. That label is `issue-to-pr` saying nothing
waits on the user, and dispatching `merge-pr` without it spends a whole CI watch before
the gate refuses the same pull request.

**3. Merge.** Dispatch a second fresh subagent, naming
[`merge-pr`](../merge-pr/SKILL.md) and the pull request number. Fresh, because the agent
that wrote the code is the worst reader of a gate judging its own work.

**4. Count the merge and loop.** The count is of merges, not of attempts.

## Stopping

Stop on the first issue that does not merge. The board is ordered, so an issue that stops
the run is the issue the user is deciding about, and taking the next one buries that
decision under a second pull request.

A run ends when the board returns no issue, the run hits the merge count, the deadline
passes, `issue-to-pr` leaves anything but `review:approved`, or `merge-pr` names a
condition it stops on.

## The report

One line per issue attempted, in the order taken:

- `#<n>` **merged** — the pull request and the merge commit
- `#<n>` **stopped** — the pull request, and the condition, quoted from the skill that
  named it

Close with why the run ended and what the user now holds. A stop leaves the branch, the
pull request and the worktree standing; `merge-pr` leaves the checkout on an up-to-date
`main` wherever one merged.

## What this skill will not do

**Resolve what stopped it.** A declined finding, a red check and a merge-gate condition
are each the user's to weigh. Reporting one and taking the next issue answers it by
walking away.

**Rerank the board.** The order is the user's.

**Start itself.** No cron, no workflow trigger, nothing that begins a run without a person
asking. Nobody reads an unwatched run, and it merges to `main` all the same.

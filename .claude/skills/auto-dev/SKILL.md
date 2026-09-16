---
name: auto-dev
description: Work the local-dnd-character-sheet board issue after issue, from open to merged — dispatch issue-to-pr then merge-pr per issue in fresh subagents, and stop on the first issue that does not merge. Use when asked to work through the board, clear the backlog, or keep going until a count or a deadline.
---

# Driving the board

[`issue-to-pr`](../issue-to-pr/SKILL.md) takes an issue to a reviewed pull request;
[`merge-pr`](../merge-pr/SKILL.md) takes that pull request to `main`. This calls them in
turn and decides only when to stop. Run every command from the main checkout.

Take a count of issues to merge, a wall-clock deadline, both, or neither — wall clock is
the only budget a skill can measure. Print a deadline once with
`echo $(( $(date +%s) + <seconds> ))` and carry the number. With neither, the run ends when
the board query returns nothing; say so before starting.

## Per issue

**1. Read the limits.** Stop where the run has merged the count, or where the deadline has
passed:

```bash
if [ "$(date +%s)" -ge <deadline> ]; then echo past; else echo within; fi
```

Read them here and nowhere else — abandoning an issue mid-flight leaves a branch and a pull
request nobody asked for. The deadline stops the next issue from starting, not the issue
already running.

**2. Build.** Dispatch a fresh subagent naming [`issue-to-pr`](../issue-to-pr/SKILL.md) and
no issue; its *Choosing, when no issue is named* picks. Reading the board here too would
make two readers that can disagree. Ask for the issue it took, the pull request number,
whatever waits on the user, and where its review pass ran. Stop where the report:

- **puts that pass outside its own subagent** — an agent that reviews its own work still
  earns `review:approved`, and GitHub cannot check the claim, so this catches a failed
  dispatch and not a skipped one
- **names no issue** — give the reason it named; that query stops the same way on a
  truncated board and on a failed `gh` call
- **names an issue and no pull request** — give the condition. Looping back either retakes
  a `blocked` issue forever or skips a `pnpm check` that failed

**3. Read the verdict.**

```bash
gh pr view <pr> --json labels --jq '[.labels[].name] | any(. == "review:approved")'
```

A `false` stops the run. The gate reads no label, so this is the only stop for a pass that
left a second issue with the user.

**4. Merge.** Dispatch a second fresh subagent naming
[`merge-pr`](../merge-pr/SKILL.md) and the pull request number — the agent that wrote the
code is the worst reader of a gate judging its own work. Stop where it names a condition
instead of a merge commit.

**5. Count the merge and loop.** `gh pr view <pr> --json state,mergeCommit` settles whether
it merged; the report of the subagent that merged it does not. A `state` other than `MERGED`
stops the run. The count is of merges, not attempts.

## The report

One line per issue attempted, in order:

- `#<n>` **merged** — the pull request, the merge commit, and anything left waiting on the
  user, such as a second issue `issue-to-pr` filed
- `#<n>` **stopped** — the pull request, the condition quoted from the skill that named it,
  and that the next run picks the same issue: the board query sorts on milestone and rank,
  never on status

Close with why the run ended, and say which of a branch, a pull request and a worktree are
there — read them off disk and GitHub rather than inferring them from where the run stopped,
since `issue-to-pr` can leave all three. Name a worktree in particular: the next run's `git
worktree add` fails on it until the user clears `.claude/worktrees/<n>`.

## What this skill will not do

**Resolve what stopped it, or skip past it.** A declined finding, a red check and a
merge-gate condition are each the user's to weigh, and the board is ordered — taking the
next issue buries that decision under a second pull request.

**Rerank the board.** The order is the user's.

**Start itself.** No cron, no workflow trigger, nothing that begins a run without a person
asking. Nobody reads an unwatched run, and it merges to `main` all the same.

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
- **names a changed mockup file** — the merge waits on the user's approval on the canvas.
  If this session holds the conversation, publish them as
  [Changing a mockup](../../../docs/mockup/README.md#changing-a-mockup) says. Either way,
  stop and report them. An approval the user gives in this conversation goes to
  [`user-signoff`](../user-signoff/SKILL.md) as step 3 says, and the run resumes at step 5

**3. Run the gate and read the label.** The gate reads no label.

```bash
node scripts/merge-gate.mjs <pr>
gh pr view <pr> --json labels --jq '[.labels[].name | select(startswith("review:"))] | join(",")'
```

Continue where the gate exits 0 and the label line reads exactly `review:approved`. Stop the
run on either failing and quote what failed: each `FAIL` line, the usage line on exit 2, or
the label line (empty means no review label). Where the stop is a fenced path, a blocking
decline or the label, and the user answers it in this conversation, run
[`user-signoff`](../user-signoff/SKILL.md) yourself; never relabel and dispatch step 4,
whose subagent would merge on a relayed answer. Then continue at step 5. Any other stop
ends the run.

**4. Merge.** Dispatch a second fresh subagent, since the agent that wrote the code is the
worst reader of a gate judging its own work. Its prompt is exactly this, with the number
substituted:

> Invoke the `merge-pr` skill for pull request `<pr>`. Report the merge commit, or the
> condition that stopped you.

Add nothing: no review commentary, no earlier denial. Stop where the report names a condition
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

## Rate limits

A subagent's report of "API rate limit exceeded" ends the run. Wait for the reset before
the next run; never retry in a loop. `gh api rate_limit` does not show the secondary limit
that expensive bursts trip, so plenty left there proves nothing.

## What this skill will not do

**Resolve what stopped it, or skip past it.** A declined finding, a red check and a
merge-gate condition are each the user's to weigh, and the board is ordered — taking the
next issue buries that decision under a second pull request. Step 3's `user-signoff` is
not skipping past it: the user weighed the stop, and the run goes on only on their word.

**Rerank the board.** The order is the user's.

**Start itself.** No cron, no workflow trigger, nothing that begins a run without a person
asking. Nobody reads an unwatched run, and it merges to `main` all the same.

**Share a dispatch.** Once step 2 or step 4 sends a subagent off, it is the worktree's only
writer until it reports back. Resuming it by hand, or dispatching a second one at the same
issue, hands the worktree two drivers — wait for the report instead.

**Research by fork.** A fork runs the dispatch prompts it inherits, as `issue-to-pr`
warns. Research with an `Explore` agent: lacking Edit, Write and Agent narrows that drift,
though its Bash can still commit.

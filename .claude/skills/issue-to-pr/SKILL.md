---
name: issue-to-pr
description: Take one local-dnd-character-sheet issue from open to a reviewed pull request — gh issue develop, implement, pnpm check, prose pass, pull request, then review it and re-review while a pass still turns up a defect. Use when asked to work, build, implement or pick up an issue in this repository, or to decide which issue here is next. Follows this repository's CONTRIBUTING.md and stops before merging.
---

# Issue to pull request

Read `CONTRIBUTING.md` first.

## Choosing, when no issue is named

Say which issue you are taking, then start. The `D&D Character Sheet` project board
decides — not the issue number, not what just merged, not how small it looks.

```bash
# from the repo root: gh reads the account from the directory
open=$(gh issue list --state open --limit 200 --json number --jq '[.[].number]')
gh project item-list 1 --owner dean-matt --limit 200 --format json |
  jq --argjson open "$open" '
    if (.items | length) < .totalCount then error("board truncated — raise --limit") else . end
    | [.items[] | select(.rank and .milestone and (.content.number | IN($open[])))]
    | sort_by(.milestone.title, .rank) | .[0]'
```

Milestones sort by title, which holds while they are numbered. An unranked or
milestone-less issue is backlog and waits for the user to name it. `null` means no
milestone holds a ranked open issue: say so and stop.

A `blocked` label with no `## Blocked by` and no `## Do not start before` is a flag rather
than a fence — read the issue and say why you are taking it. Where the condition still
holds, stop and name it; reranking is the user's call.

## The sequence

1. **Read the issue in full**, acceptance criteria and **Out of scope** both. Out of scope
   is a fence.
2. **Verify every count and shape the issue states against `vendor/`** before designing
   against it. Say which are wrong, or that `vendor/` was not there to ask.
3. **Branch into a worktree.** Enter it with `cd`, not the harness's worktree tool, which
   refuses every `git` call a shell wrapper rewrites.

   ```bash
   main=$(git rev-parse --show-toplevel); b=<type>/<n>-<slug>; d=.claude/worktrees/<n>
   gh issue develop <n> --name "$b"
   git fetch --quiet origin "$b"
   git worktree prune
   git worktree add --quiet "$d" "$b"
   cd "$d" && pnpm install --frozen-lockfile && mkdir -p vendor
   for p in vendor/5etools data/content.db .claude/settings.local.json; do
     [ -e "$main/$p" ] && ln -sfn "$main/$p" "$p"
   done
   ```

   The add fails where a directory is already there — another agent on this issue, or a
   crash. Clear it by hand once no agent holds it. Never link `characters.db`: two agents
   writing it collide. Run every later step from the worktree; step 14 removes it.

   Then set the board to `In Progress`; its own workflow waits for the pull request.
   `item-add` returns the item an issue already has, and the other three ids hold still, so
   read them once a session.

   ```bash
   gh project item-add 1 --owner dean-matt --url <issue-url> --format json --jq .id
   gh project view 1 --owner dean-matt --format json --jq .id
   gh project field-list 1 --owner dean-matt --format json --jq '.fields[] | select(.name == "Status")'
   gh project item-edit --id <item> --project-id <project> --field-id <field> --single-select-option-id <option>
   ```
4. **Invoke the skill the change needs**, where `CLAUDE.md` indexes one.
5. **Implement**, stopping at the first rung of `CLAUDE.md`'s ladder that holds. Tests ride
   with the code they cover, and every command written into a skill is run before it lands.
6. **Correct the docs the change made stale**, in the same commit. Past a `docs/` or
   `CLAUDE.md` cap, replace a sentence rather than append; a new `docs/` file needs a
   README row.
7. **Prose pass** with `writing-clearly-and-concisely` over every piece of prose the change
   wrote — commit message, comments, `docs/`, a skill, `CLAUDE.md`. A skill says what to
   do; keep a reason only where losing it lets the next agent delete a fence or walk into a
   failure that passes silently.
8. **`pnpm check`, then commit and push**, once per concern the issue carries. Run it after
   steps 6 and 7 — pre-commit runs neither the tests nor the caps. Never push past a
   failure with a note about it.
9. **Open the pull request** with `gh pr create`, body linking the issue and prose passed.
   This starts CI; the pushes before it started nothing.
10. **Dispatch the review to a subagent** whose prompt carries the pull request number and
    nothing else — no rationale, no account of what you wrote, no defense of a choice. It
    invokes [`audit-pr`](../audit-pr/SKILL.md), which reviews from its own worktree. Its
    findings reach step 11 unchanged.
11. **Post the pass as one review, before applying** — a run that dies mid-apply then
    leaves the findings standing rather than a label pointing at nothing. One call sends
    `commit_id`, `event`, a `body` and each line comment as `{path, line, side, body}`;
    posted one at a time they arrive as a review each. The `body` holds what the pass found
    and any finding no line anchors. `event` is `COMMENT`, because GitHub refuses an
    approval on your own pull request; step 14's labels carry that verdict.

    ```bash
    gh api 'repos/{owner}/{repo}/pulls/<n>/reviews' --input <the pass, as json>
    gh api 'repos/{owner}/{repo}/pulls/<n>/reviews/<review>/comments' --jq '.[].id'
    gh api 'repos/{owner}/{repo}/pulls/<n>/comments/<id>/replies' -f body=<the verdict>
    ```

    A pass returning nothing posts nothing and applies nothing: skip to step 14. A later
    pass adds, leaving earlier threads alone.
12. **Label, apply, reply.** Swap `review:changes-requested` on first, in one `gh pr edit
    <n> --add-label <one> --remove-label <other>`, so the mark and the findings stand
    together. Then apply what survives, `pnpm check`, prose pass what the fixes touched,
    commit, push, and bring the pull request body back in line — fixes left in the working
    tree leave the pull request holding the code the review rejected.

    Reply into each thread last, `**Applied** in <sha>` or `**Declined** — <reason>`, so
    every finding carries a verdict. Each reply lands as its own empty review. A fix that
    moves a line outdates its thread, and the reply still posts.
13. **Repeat 10 to 12 while a pass returns a `critical` or `warning` finding**, three
    passes at most, a fresh subagent each so none inherits the last one's conclusions. A
    finding you declined comes back and takes the same reply. Only `comment` findings left
    has stopped paying.
14. **Label, then stop.** `review:approved` where `pnpm check` is green and nothing a pass
    returned still waits on the user; `review:changes-requested` where something does — a
    decline, a second bug filed as its own issue, a red check. Preferences wait on nobody.

    Then remove the worktree from anywhere inside it: `cd "$(git rev-parse
    --show-toplevel)/../../.."` reaches the main checkout, and `git worktree remove
    .claude/worktrees/<n>` refuses rather than discarding anything step 12 left
    uncommitted. The branch and the pull request stand.

    Report what landed, what each review found, and what `gh pr checks` says. A run still
    in flight is reported in flight rather than waited on; a red run is the user's to weigh.

## The pull request body

`Closes #<issue>` on the first line. Then what the change does and, for anything a reviewer
would otherwise derive, the entry in the data that decided it as `Name` (SOURCE). Close
with the verification: "`pnpm check` is green" is the floor, so say what ran against the
real corpus and what came out.

## What this skill will not do

**Merge.** Report and wait, whatever the review found and however small the change.

**Widen the issue.** A second bug found on the way is a second issue: file it or name it
in the report, and leave it out of this branch.

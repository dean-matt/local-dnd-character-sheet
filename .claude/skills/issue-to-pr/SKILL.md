---
name: issue-to-pr
description: Take one local-dnd-character-sheet issue from open to a reviewed pull request — gh issue develop, implement, pnpm check, prose pass, pull request, then review it and re-review while a pass still turns up a defect. Use when asked to work, build, implement or pick up an issue in this repository, or to decide which issue here is next. Follows this repository's CONTRIBUTING.md and stops before merging.
---

# Issue to pull request

Read `CONTRIBUTING.md` first; it holds the reasoning these steps assume.

## Choosing, when no issue is named

Say which issue you are taking, then start.

The `D&D Character Sheet` project board decides — not the issue number, not which code
just merged, not how small it looks.

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
milestone-less issue is backlog: the filter drops it and it waits for the user to name
it. `null` means no milestone holds a ranked open issue — say so and stop.

A `blocked` label with no `## Blocked by` and no `## Do not start before` is a flag
rather than a fence: read the issue and say why you are taking it. Where the condition
still holds, the rank is stale rather than the issue skippable — name it and stop,
because reranking is the user's call.

## The sequence

1. **Read the issue in full**, acceptance criteria and **Out of scope** both. Out of
   scope is a fence, not a suggestion.
2. **Where the issue states counts or shapes, verify them against `vendor/`** before
   designing against them: an issue states them from an earlier read and can be wrong
   about its own corpus. Say which are wrong, or that `vendor/` was not there to ask.
3. **Branch into a worktree**, so a second agent can take a second issue at the same
   time. Enter it with `cd`, not the harness's worktree tool, which refuses every `git`
   call a shell wrapper rewrites.

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
   crash. Clear it by hand once no agent holds it. Never link `characters.db` — two
   agents writing it collide. Every later step runs from the worktree, and step 14
   removes it.

   Then set the board to `In Progress`; its own workflow waits for the pull request.
   `item-add` returns the item an issue already has; the other three ids hold still, so
   read them once a session.

   ```bash
   gh project item-add 1 --owner dean-matt --url <issue-url> --format json --jq .id
   gh project view 1 --owner dean-matt --format json --jq .id
   gh project field-list 1 --owner dean-matt --format json --jq '.fields[] | select(.name == "Status")'
   gh project item-edit --id <item> --project-id <project> --field-id <field> --single-select-option-id <option>
   ```
4. **Invoke the skill the change needs**, where `CLAUDE.md` indexes one.
5. **Implement**, stopping at the first rung of the ladder in `CLAUDE.md` that holds.
   Tests ride with the code they cover, and a command written into a skill is run before
   it lands — whoever reads that skill next executes it.
6. **Correct the docs the change made stale**, in the same commit. `docs/` and
   `CLAUDE.md` have caps, and a new `docs/` file needs a README row: past a cap,
   replace a sentence rather than append.
7. **Prose pass** with `writing-clearly-and-concisely` over all the prose the change
   wrote — commit message, comments, `docs/`, a skill, `CLAUDE.md` — and weigh the
   register: a skill is instructions an agent rereads, not an essay a human reads once.
8. **`pnpm check`, then commit and push**, once per concern the issue carries. Never
   push past a failure with a note about it, and run it after steps 6 and 7:
   pre-commit runs neither the tests nor the caps.
9. **Open the pull request** with `gh pr create`, body linking the issue and prose
   passed. This is what starts CI; the pushes before it started nothing.
10. **Review it** with [`audit-pr`](../audit-pr/SKILL.md), which reviews from a
    worktree and leaves this branch where it is.
11. **Post the pass as one review**, before you apply, so a run that dies mid-apply
    leaves the findings standing rather than a label pointing at nothing. One call sends
    `commit_id`, `event`, a `body` and each line comment as `{path, line, side, body}`;
    posted one at a time they arrive as a review each. The `body` says what the pass
    found and holds any finding no line anchors. The verdicts say what became of each,
    and they come after the fixes. `event` is `COMMENT`, because GitHub refuses an
    approval on your own pull request — step 14's labels carry that verdict instead.

    ```bash
    gh api 'repos/{owner}/{repo}/pulls/<n>/reviews' --input <the pass, as json>
    gh api 'repos/{owner}/{repo}/pulls/<n>/reviews/<review>/comments' --jq '.[].id'
    gh api 'repos/{owner}/{repo}/pulls/<n>/comments/<id>/replies' -f body=<the verdict>
    ```

    A pass that returns nothing posts nothing and applies nothing, so skip step 12;
    step 14 labels. A later pass adds, leaving earlier threads alone.
12. **Label, apply, reply.** Swap `review:changes-requested` on first, so the mark and
    the findings stand together; one `gh pr edit <n> --add-label <one> --remove-label
    <other>` does both halves. Then apply what survives, `pnpm check`, prose pass what
    the fixes touched, commit and push, and bring the pull request body back in line —
    fixes left in the working tree leave the pull request holding the code the review
    rejected.

    Reply into each thread last, `**Applied** in <sha>` or `**Declined** — <reason>`, so
    every finding carries a verdict. Every reply lands as its own empty review, so expect
    one per verdict beside the pass's. A fix that moves a line outdates its thread —
    Files changed folds it, but the reply still posts and the Conversation tab shows
    both.
13. **Repeat 10 to 12 while a pass returns a `critical` or `warning` finding**, three
    passes at most. A pass returning only `comment` findings has stopped paying.
14. **Label, then stop.** `review:approved` where `pnpm check` is green and nothing a
    pass returned still waits on the user; `review:changes-requested` where something
    does — a decline, a second bug filed as its own issue, a red check. Preferences wait
    on nobody. Then remove the worktree from anywhere inside it:
    `cd "$(git rev-parse --show-toplevel)/../../.."` reaches the main checkout, and
    `git worktree remove .claude/worktrees/<n>` refuses rather than discarding anything
    step 12 left uncommitted. The branch and the pull request stand.

    Then report what landed, what each review found, and what `gh pr checks`
    says, reporting a run still in flight as in flight rather than waiting on it. A red
    run is the user's to weigh.

## The pull request body

`Closes #<issue>` on the first line. Then what the change does and, for anything a
reviewer would otherwise derive, the entry in the data that decided it, named as
`Name` (SOURCE). Close with the verification: "`pnpm check` is green" is the floor, so
say what ran against the real corpus and what came out.

## What this skill will not do

**Merge.** Report and wait, whatever the review found and however small the change.

**Widen the issue.** A second bug found on the way is a second issue: file it or name it
in the report, and leave it out of this branch.

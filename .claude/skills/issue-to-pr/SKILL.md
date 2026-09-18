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

1. Set the board to `In Progress`; its own workflow waits for the pull request.
   `item-add` returns the item an issue already has, and the other three ids hold still, so
   read them once a session.

   ```bash
   gh project item-add 1 --owner dean-matt --url <issue-url> --format json --jq .id
   gh project view 1 --owner dean-matt --format json --jq .id
   gh project field-list 1 --owner dean-matt --format json --jq '.fields[] | select(.name == "Status")'
   gh project item-edit --id <item> --project-id <project> --field-id <field> --single-select-option-id <option>
   ```
2. **Read the issue in full**, acceptance criteria and **Out of scope** both. Out of scope
   is a fence.
3. **Verify every count and shape the issue states against `vendor/`** before designing
   against it. Say which are wrong, or that `vendor/` was not there to ask.
4. **Branch into a worktree.** Enter it with `cd`, not the harness's worktree tool, which
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
   writing it collide. Run every later step from the worktree; step 12 removes it.
5. **Invoke the skill the change needs**, where `CLAUDE.md` indexes one.
6. **Implement**, stopping at the first rung of `CLAUDE.md`'s ladder that holds. Tests ride
   with the code they cover, and every command written into a skill is run before it lands.
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
12. **Remove the worktree**, from anywhere inside it: `cd "$(git rev-parse
    --show-toplevel)/../../.."` reaches the main checkout, and `git worktree remove
    .claude/worktrees/<n>` refuses rather than discarding anything `converge-review` left
    uncommitted. The branch and the pull request stand.

    Report what `converge-review` returned. A run still in flight is reported in flight
    rather than waited on; a red run is the user's to weigh.

## What this skill will not do

**Merge.** Report and wait, whatever the review found and however small the change.

**Widen the issue.** A second bug found on the way is a second issue: file it or name it
in the report, and leave it out of this branch. `gh issue create` leaves that issue off the
board, so put it there with step 1's `item-add`. It lands unranked and without a milestone,
which [`pick-issue`](../pick-issue/SKILL.md) reads as backlog until the user ranks it under
a milestone.

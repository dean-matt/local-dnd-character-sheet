---
name: issue-to-pr
description: Take one local-dnd-character-sheet issue from open to a reviewed pull request — gh issue develop, implement, pnpm check, prose pass, pull request, then review it and re-review while a pass still turns up a defect. Use when asked to work, build, implement or pick up an issue in this repository, or to decide which issue here is next. Follows this repository's CONTRIBUTING.md and stops before merging.
---

# Issue to pull request

Read `CONTRIBUTING.md` first; it holds the reasoning these steps assume.

## Choosing, when no issue is named

Say which issue you are taking and start. Naming it first makes a wrong pick cost a
sentence rather than a branch.

The `D&D Character Sheet` project board decides. Its one view groups by milestone and
sorts by a `Rank` number field, which the user sets knowing what blocks what and what an
audit has to follow. Milestones order the work above it, so the live one is the
lowest-numbered holding a ranked open issue.

Take the open issue with the lowest `Rank` in the live milestone. Nothing else decides
it — not the issue number, not which code just merged, not how small it looks.

```bash
# from the repo root: gh reads the account from the directory
gh project item-list 1 --owner dean-matt --limit 200 --format json
gh issue list --state open --limit 200 --json number
```

Pass both limits and check `.items | length` against `.totalCount`: each command defaults
to 30 rows and truncates in silence, hiding the ranked issue you came for. An item holds
`rank`, `milestone`, `status`, `labels`, `content.number` and `content.body`, and omits
`rank` when unranked. `status` is hand-maintained, so the open list says what is open.

An issue with no rank or no milestone is backlog: it waits for the user to name it and
holds no milestone open. Where no milestone holds a ranked open issue, say so and stop.

A `blocked` label with no `## Blocked by` and no `## Do not start before` is a flag
rather than a fence: read the issue and say why you are taking it. Where the top-ranked
issue names a condition that still holds, the rank is stale rather than the issue
skippable — name the condition and stop, because reranking is the user's call.

## The sequence

1. **Read the issue in full**, acceptance criteria and **Out of scope** both. Out of
   scope is a fence, not a suggestion.
2. **Where the issue states counts or shapes, verify them against `vendor/`** before
   designing against them: an issue states them from an earlier read and can be wrong
   about its own corpus. Say which are wrong, or that `vendor/` was not there to ask.
3. **Branch** with `gh issue develop <n> --name <type>/<n>-<slug> --checkout`.
4. **Invoke the skill the change needs**, where `CLAUDE.md` indexes one — not this
   one, which is the sequence around the work rather than the work.
5. **Implement**, stopping at the first rung of the ladder in `CLAUDE.md` that holds.
   Tests ride with the code they cover.
6. **Correct the docs the change made stale**, in the same commit. `docs/` and
   `CLAUDE.md` have caps, and a new `docs/` file needs a README row: past a cap,
   replace a sentence rather than append.
7. **Prose pass** with `writing-clearly-and-concisely` over the commit message and
   every comment the change touched.
8. **`pnpm check`, then commit and push**, once per concern the issue carries. Never
   push past a failure with a note about it, and run it after steps 6 and 7:
   pre-commit runs neither the tests nor the caps.
9. **Open the pull request** with `gh pr create`, body linking the issue and prose
   passed. This is what starts CI; the pushes before it started nothing.
10. **Review it** with `/code-review <pr> <level>`, naming the level, which otherwise
    inherits whatever was typed last. Then check `git branch --show-current`: the
    review leaves the tree where it checked out, and a detached HEAD commits onto
    nothing without the branch-name hook saying so. A pass returning anything to weigh
    swaps `review:changes-requested` on before you apply, so a run that dies mid-apply
    leaves the pull request marked. One `gh pr edit <n> --add-label <one> --remove-label
    <other>` does both halves, so it never carries both.
11. **Apply what survives**, `pnpm check`, prose pass what the fixes touched, commit
    and push, and bring the pull request body back in line. Fixes left in the working
    tree leave the pull request holding the code the review rejected.
12. **Repeat 10 and 11 while a pass returns something that would fail at runtime,
    mislead a reader, or contradict the repo**, three passes at most. A pass returning
    only preferences has stopped paying.
13. **Label, then stop.** `review:approved` where `pnpm check` is green and nothing a
    pass returned still waits on the user; `review:changes-requested` where something
    does — a decline, a second bug filed as its own issue, a red check. Preferences wait
    on nobody, and CI does not enter into it. Then report what landed, what each review
    found, and what `gh pr checks` says, noting a run still in flight as in flight. The
    gate needs `pnpm build` and the end-to-end tests green too, and `pnpm check` runs
    neither, so local green is not the answer. A red run is the user's to weigh, as is
    the merge, every time.

## The pull request body

`Closes #<issue>` on the first line. Then what the change does and, for anything a
reviewer would otherwise derive, the entry in the data that decided it, named as
`Name` (SOURCE).

Close with the verification. "`pnpm check` is green" is the floor: say what ran
against the real corpus and what came out.

## What this skill will not do

**Merge.** Report and wait, whatever the review found and however small the change.

**Widen the issue.** A second bug found on the way is a second issue. File it or name
it in the report; leave it out of this branch.

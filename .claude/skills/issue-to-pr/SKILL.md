---
name: issue-to-pr
description: Take one local-dnd-character-sheet issue from open to a reviewed pull request: gh issue develop, implement, pnpm check, prose pass, pull request, then review both the pull request and the fixes to it. Use when asked to work, build, implement or pick up an issue in this repository, or to decide which issue here is next. Follows this repository's CONTRIBUTING.md and stops before merging.
---

# Issue to pull request

The order the stages run in. `CONTRIBUTING.md` carries the reasoning behind the
branch, commit and pull request rules; read it first.

## Choosing, when no issue is named

Pick one, say which and why in a sentence, and start. Naming it first makes a wrong
pick cost a sentence rather than a branch.

Milestones are numbered and are the build order, so the live one is the
lowest-numbered with any issue open. Take from it alone: an issue carrying no
milestone is backlog, however small it looks, and waits for the user to name it.

Within the live milestone, in order:

1. Drop anything `blocked` whose blocker is still open. Read the blocker rather than
   the label, which stays behind when the blocker closes.
2. Leave an audit of the milestone's own work until last. It reads code that keeps
   moving until the milestone's final issue lands.
3. Prefer the issue that builds on what just merged, while that code is fresh.

When the audit is all that remains, take it: last is where it belongs. When nothing
remains, the next milestone is live.

## The sequence

1. **Read the issue in full**, acceptance criteria and **Out of scope** both. Out of
   scope is a fence, not a suggestion.
2. **Where the issue states counts or shapes, verify them against `vendor/`** before
   designing against them. It states them from an earlier read and can be wrong about
   its own corpus. Say so when one is.
3. **Branch** with `gh issue develop <n> --name <type>/<n>-<slug> --checkout`.
4. **Invoke the skill the work names**, where `CLAUDE.md` indexes one.
5. **Implement**, stopping at the first rung of the ladder in `CLAUDE.md` that holds.
   Tests ride with the code they cover.
6. **`pnpm check`** until green. Never push past a failure with a note about it.
7. **Correct the docs the change made stale**, in the same commit. `docs/` and
   `CLAUDE.md` both have caps: past one, replace a sentence rather than append.
8. **Prose pass** with `writing-clearly-and-concisely` over the commit message, the
   pull request body, and every comment the change touched.
9. **Commit and push.** One concern per commit.
10. **Open the pull request** with `gh pr create`, body linking the issue.
11. **Review it** with `/code-review <pr>`. Check `git branch --show-current` before
    editing anything: the review checks out what it reviewed and leaves it there.
12. **Apply what survives**, then `pnpm check`, commit and push. Fixes that sit in
    the working tree leave the pull request holding the code the review rejected.
13. **Review the fixes** with `/code-review <first fix>..<last fix>`, and repeat 12
    and 13 until a pass comes back clean. Always, not by judgment: the fixes are the
    least-reviewed code on the branch, and a fix covering one instance of a class
    rather than the class is how this goes wrong.
14. **Stop.** Report what landed and what each review found. The merge is the user's
    call, every time.

## The pull request body

`Closes #<issue>` on the first line. Then what the change does and, for anything a
reviewer would otherwise derive, the entry in the data that decided it — named as
`Name` (SOURCE). A design choice with a witness reads as a finding; the same choice
without one reads as a preference.

Close with the verification. "`pnpm check` is green" is the floor: say what ran
against the real corpus and what came out.

## Counts are evidence, so source them

A reader acts on a number in a comment, a commit message or a pull request body,
because it is the reason the code is shaped the way it is. Cite one only from a
measurement made this session, and re-run it after any change that could move it.
`CONTRIBUTING.md` makes the same argument about a hand-edited fixture.

Both ways it goes wrong are invisible once written: quoting a count taken before the
fix as though it described the state after, and reading the neighbouring row of your
own output — the population sharing a name with the one you meant.

## What this skill will not do

**Merge.** Report and wait, whatever the review found and however small the change.

**Widen the issue.** A second bug found on the way is a second issue. File it or name
it in the report; leave it out of this branch.

**Raise a cap to fit.** The line caps on `CLAUDE.md`, `docs/` and a skill are the
fence: hitting one means extracting, not editing the number.

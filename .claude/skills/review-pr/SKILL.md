---
name: review-pr
description: Review a pull request in this repository through the lenses it actually needs — the coding ladder, test depth, the issue's own criteria, and the 5e, catalog, API and accessibility judgments that fire only where the diff reaches them. Use when reviewing a pull request here, from issue-to-pr or by hand. Skips everything pnpm check and the shape tests already assert.
---

# Reviewing a pull request

## What a pass never looks for

`pnpm check` and the `tests/*-shape` suites assert types, lint, dead code, spelling, the
comment policy and the document caps, and each fails before a pull request exists. A
finding there is either already red or already wrong. So say nothing about formatting,
import order, a missing annotation, a line length, a ticket key in a comment, or a file
over a cap. Adding that coverage back re-checks a fence that has already run.

The pattern is assert it rather than request it, so most of what a general reviewer looks
for is already a failing test. What is left is where this pass spends itself:
`CONTRIBUTING.md` names the two judgments no fence can make — whether an abstraction is
warranted, and how many tests a piece of logic deserves — and the invariants below name
the rest.

## What to read

Code comes from a worktree at the pull request's head, so every local read is the commit
under review and the caller's tree never moves:

```bash
n=<pr>
head=$(gh pr view "$n" --json headRefOid --jq .headRefOid)
dir="${TMPDIR:-/tmp}/review-pr-$n"
git fetch --quiet origin "$head"
git worktree prune && git worktree remove --force "$dir" 2>/dev/null
git worktree add --detach --quiet "$dir" "$head"
git -C "$dir" diff origin/main...HEAD -- . ':(exclude)tests/fixtures/5etools/*' \
  ':(exclude)pnpm-lock.yaml' ':(exclude)content.lock.json'
```

`--detach` because the branch is already checked out in the caller's tree, which git
refuses to do twice. Outside the repository, because a worktree inside it joins every
glob `pnpm check` runs. Pruning before the add rather than trusting the remove after
means a pass that died cleans up on the next run. Read every file for context from
`$dir`, and end the pass with `git worktree remove --force "$dir"`.

The excludes are the generated files. Count them by rerunning the diff with
`--name-only` and no pathspec. A fixture is wrong only where its declaration is wrong,
so read `packages/content/src/fixtures/declaration.ts` instead of the rows it wrote.

The pull request itself has no copy on disk, so it comes from `gh`:

```bash
gh pr view <n> --json title,body
gh pr checks <n>
```

Read the issue the body closes. The QA lens weighs the change against its acceptance
criteria and **Out of scope**, which nothing else states.

A red check is a finding. `pnpm check` runs on one platform and covers neither
`pnpm build` nor the end-to-end tests, so a green local run leaves the Windows job and
the e2e job unread.

## The lenses

Three run on every pull request, because every change is subject to them:

**Senior engineer** — the ladder in `CLAUDE.md`. Did this need to exist, does it already
exist here, does an installed dependency do it, can it be one line. Package boundaries
hold, and the change fixes the root cause rather than the path the issue named — one
shared function, not every caller.

**Tester** — test depth. Non-trivial logic leaves behind the smallest runnable check that
fails if it breaks; tests ride with the code they cover; fixtures widen through their
declaration rather than by hand. A test that asserts the implementation back to itself
counts as none.

**QA** — the change against its issue. Every acceptance criterion met, **Out of scope**
respected, and the edges exercised: empty, absent, zero, negative, the multiclass case,
the homebrew row that shadows a catalog one.

The rest fire only where the diff reaches what they read, so a `repo`-only change runs
three lenses rather than seven:

| Lens | Fires on | Weighs |
|---|---|---|
| Rules lawyer | `packages/{rules,character,dice,tags}` | Whether the arithmetic is what 5e says, whether the `classic` and `one` split holds, and the token contract [`tag-render`](../tag-render/SKILL.md) states |
| Data steward | `packages/content` | What [`content-import`](../content-import/SKILL.md) states: identity keys, edition tiers, `_copy` resolution, the lockfile, and interpolation in the raw SQL that builds the catalog |
| API contract | `packages/api` | What [`add-endpoint`](../add-endpoint/SKILL.md) states: the Zod to OpenAPI to Drizzle to query-hook order, spec drift, and a migration that cannot be rerun |
| UI and accessibility | `packages/web` | Semantics, keyboard reachability, contrast — what the `accessibility` label marks |

A lens returning nothing is the common case rather than a failure.

## The invariants no test asserts

Each of these fails as a plausible wrong answer rather than as an error, so a reader has
to catch it:

- **Every content entity is keyed `(name, source)`**, never name alone, and a character
  references a catalog row by that key rather than copying it. A key of name alone
  collides across books and answers with the wrong book's entry.
- **The three-database rule.** `content.db` is read-only, rebuilt wholesale, never
  migrated, and reached through raw SQL; `characters.db` and `homebrew.db` take Drizzle
  migrations. The next build discards anything written to `content.db`.
- **A derived character field stores the computed value, the manual one and an override
  flag.** A field holding one number lets a level-up stomp a user's edit.
- **`roll_log` and `undo_log` are bounded** per character and pruned on insert, to the
  numbers `CLAUDE.md` holds. An insert path that skips the prune grows the table without
  limit.
- **An unknown `{@tag}` degrades to plain text.** A renderer that throws on unrecognized
  markup takes the sheet down over one upstream addition.
- **`rules` takes primitives and never a `CharacterDefinition`.** A function wanting the
  whole character is a projection and belongs with the schemas.
- **Replacing an approach deletes the old one in the same commit.** `knip` catches an
  abandoned file, but not a second path left reachable beside its successor.

## What a finding says

One finding, one defect, in this shape, so it survives posting as a comment on the line
it concerns:

```
packages/rules/src/spell-slots.ts:42  bug
A multiclass caster's slots read the highest class level rather than the sum.
A level 3 cleric and level 3 wizard get 2nd-level slots instead of 3rd.
```

The severity is one of three, and it decides whether the loop keeps paying:

| Severity | Means |
|---|---|
| `bug` | Wrong at runtime, or misleading about what the code does |
| `repo` | Contradicts a rule in `CLAUDE.md`, `CONTRIBUTING.md` or a skill |
| `preference` | Neither — a taste call, reported once and left there |

Where a finding names no line, report it against the file or the pull request. A pass
returning only `preference` findings ends the loop.

## What this skill will not do

**Touch the caller's tree.** The worktree holds the commit under review, so the branch
stays where step 11 needs it. A checkout there strands step 11 on a detached HEAD, where
the branch-name hook goes quiet and a commit lands anywhere.

**Apply what it finds, or label the pull request.** The pass returns findings; steps 10
to 13 of [`issue-to-pr`](../issue-to-pr/SKILL.md) decide what happens to them.

---
name: audit-pr
description: Review one local-dnd-character-sheet pull request through this repository's own lenses — the coding ladder, test depth, the issue's own criteria, the prose it writes, and the 5e, catalog, API and accessibility judgments that fire only where the diff reaches them. Use when reviewing a pull request here, from issue-to-pr or by hand. Skips everything pnpm check and the shape tests already assert.
---

# Reviewing a pull request

The pull request number is the whole input. An agent that knows how the change was written
reads its own intent into the diff and reviews that intent rather than the code.

## Skip what the fences assert

Say nothing about formatting, import order, annotations, line length, a ticket key, or a
file over a cap: `pnpm check` and the `tests/*-shape` suites assert all of it before a pull
request exists. Review the subject instead — whether an abstraction is warranted, how many
tests a piece of logic deserves, and the invariants below.

## What to read

Read the code from a worktree at the head, so every local read is the commit under review
and the caller's tree never moves:

```bash
n=<pr>
head=$(gh pr view "$n" --json headRefOid --jq .headRefOid)
dir="${TMPDIR:-/tmp}/audit-pr-$n"
git fetch --quiet origin main "$head"
git worktree prune
git worktree remove --force "$dir" 2>/dev/null || true
git worktree add --detach --quiet "$dir" "$head"
git -C "$dir" diff origin/main...HEAD -- . ':(exclude)tests/fixtures/5etools/*' \
  ':(exclude)pnpm-lock.yaml' ':(exclude)content.lock.json'
```

Keep it outside the repository, where it joins no glob `pnpm check` runs, and fetch `main`
too, or a stale merge base widens the diff. Pruning before the add cleans up after a pass
that died. End the pass with `git worktree remove --force "$dir"`.

Count the excluded paths by rerunning the diff with `--name-only` and those paths as the
pathspec. Read `packages/content/src/fixtures/declaration.ts`, never the rows it wrote.

```bash
gh pr view "$n" --json title,body        # the body names the issue it closes
gh issue view <issue> --json title,body  # acceptance criteria and Out of scope
gh pr checks "$n"
```

A red check is a finding — `pnpm check` misses the build, the end-to-end tests and Windows.
`gh pr checks` also exits non-zero on a run still in flight, which is reported in flight
rather than waited on.

## The lenses

Four run on every pull request:

- **Senior engineer** — the ladder in `CLAUDE.md`: need it, exists here already, one line.
  Package boundaries, and the root cause over the path the issue named.
- **Tester** — non-trivial logic leaves a check that fails if it breaks, tests ride with
  their code, fixtures widen through their declaration. A test asserting the implementation
  back to itself counts as none.
- **QA** — acceptance criteria met, **Out of scope** respected, edges exercised: empty,
  absent, zero, negative, multiclass, a homebrew row shadowing a catalog one.
- **Editor** — the prose the change writes: commit message, pull request body, `docs/`, a
  skill, a comment. Take it through `writing-clearly-and-concisely`, then weigh what that
  cannot: a sentence ambiguous rather than dense, and a register that fits its reader —
  instructions an agent rereads every pass, in the voice a developer writes, not a
  technical writer. A skill says what to do, and a reason earns its line only where losing
  it lets the next agent delete a fence or walk into a failure that passes silently. A
  comment restating the code is a finding, and
  history and markers belong in the commit message and the pull request body alone.

Four more fire only where the diff reaches them, so a `repo`-only change runs the four
above and stops:

| Lens | Fires on | Weighs |
|---|---|---|
| Rules lawyer | `packages/{rules,character,dice,tags}` | Whether the arithmetic is what 5e says, whether the `classic` and `one` split holds, and the token contract [`tag-render`](../tag-render/SKILL.md) states |
| Data steward | `packages/content` | What [`content-import`](../content-import/SKILL.md) states: identity keys, edition tiers, `_copy` resolution, the lockfile, and interpolation in the raw SQL |
| API contract | `packages/api` | What [`add-endpoint`](../add-endpoint/SKILL.md) states: the Zod to OpenAPI to Drizzle to query-hook order, spec drift, a migration that cannot be rerun |
| UI and accessibility | `packages/web` | Semantics, keyboard reachability, contrast — what the `accessibility` label marks |

A lens returning nothing is the common case rather than a failure.

## The invariants no test asserts

Each fails as a plausible wrong answer rather than an error:

- **`(name, source)` keys every content entity**, and a character references rather than
  copies one. Name alone collides across books.
- **Three databases.** `content.db` read-only, rebuilt, never migrated, raw SQL;
  `characters.db` and `homebrew.db` take Drizzle migrations. The next build discards
  anything written to `content.db`.
- **Derived fields store the computed value beside a nullable manual one.** One number lets
  a level-up stomp an edit.
- **`roll_log` and `undo_log` are bounded and pruned on insert**, to `CLAUDE.md`'s numbers.
  A skipped prune grows the table without limit.
- **An unknown `{@tag}` degrades to plain text.** A throw takes the sheet down.
- **`rules` takes primitives, never a `CharacterDefinition`.** Wanting the whole character
  makes it a projection.
- **Replacing an approach deletes the old one.** `knip` finds an abandoned file, not a
  second reachable path.

## What a finding says

Open with the severity in bold and nothing before it, then the defect and what it costs.
The location anchors the comment rather than opening the body — against
`packages/rules/src/spell-slots.ts:42`:

```
**critical** — a multiclass caster's slots read the highest class level rather than the sum.
A level 3 cleric and level 3 wizard get 2nd-level slots instead of 3rd.
```

| Severity | Means |
|---|---|
| `critical` | Wrong at runtime, or misleading about what the code does |
| `warning` | Contradicts `CLAUDE.md`, `CONTRIBUTING.md` or a skill |
| `comment` | Neither — a taste call, reported once |

Write `**critical**`, never `` `critical` ``. The marker carries onto the posted comment,
where `scripts/merge-gate.mjs` is its only reader and one it cannot parse stops the merge.
`tests/review-severity.test.ts` holds this table to that parser.

A finding naming no line goes against the file or the pull request. Every finding goes to
the caller's report, and [`issue-to-pr`](../issue-to-pr/SKILL.md) step 13 decides whether
another pass follows.

## What this skill will not do

**Touch the caller's tree.** A checkout there strands the caller on a detached HEAD, where
the branch-name hook goes quiet and a commit lands anywhere. Settling a claim by running
something is not touching it — the worktree has no `node_modules`, so use a scratch
repository and change nothing tracked.

**Apply findings, post them, or label the pull request.** Steps 11 to 14 of
[`issue-to-pr`](../issue-to-pr/SKILL.md) do that.

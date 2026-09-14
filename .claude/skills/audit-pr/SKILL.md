---
name: audit-pr
description: Review one local-dnd-character-sheet pull request through this repository's own lenses — the coding ladder, test depth, the issue's own criteria, the prose it writes, and the 5e, catalog, API and accessibility judgments that fire only where the diff reaches them. Use when reviewing a pull request here, from issue-to-pr or by hand. Skips everything pnpm check and the shape tests already assert.
---

# Reviewing a pull request

## Skip what the fences assert

`pnpm check` and the `tests/*-shape` suites assert types, lint, dead code, spelling, the
comment policy and the document caps, and each fails before a pull request exists. Say
nothing about formatting, import order, annotations, line length, a ticket key, or a file
over a cap.

What no fence decides is the subject: whether an abstraction is warranted, how many tests
a piece of logic deserves, and the invariants below.

## What to read

Code comes from a worktree at the head, so every local read is the commit under review
and the caller's tree never moves:

```bash
n=<pr>
head=$(gh pr view "$n" --json headRefOid --jq .headRefOid)
dir="${TMPDIR:-/tmp}/audit-pr-$n"
git fetch --quiet origin "$head"
git worktree prune && git worktree remove --force "$dir" 2>/dev/null
git worktree add --detach --quiet "$dir" "$head"
git -C "$dir" diff origin/main...HEAD -- . ':(exclude)tests/fixtures/5etools/*' \
  ':(exclude)pnpm-lock.yaml' ':(exclude)content.lock.json'
```

Outside the repository, or the worktree joins every glob `pnpm check` runs. Pruning
before the add means a pass that died cleans up on the next run. Read context from
`$dir`, and end the pass with `git worktree remove --force "$dir"`.

The excludes are generated. Count them with `--name-only` and no pathspec, and read
`packages/content/src/fixtures/declaration.ts` rather than the fixture rows it wrote.

```bash
gh pr view <n> --json title,body   # and the issue it closes — what the QA lens weighs
gh pr checks <n>                   # a red check is a finding: pnpm check misses build, e2e, Windows
```

## The lenses

Four run on every pull request:

- **Senior engineer** — the ladder in `CLAUDE.md`: need it, exists here already, one
  line. Package boundaries, and the root cause over the path the issue named.
- **Tester** — non-trivial logic leaves a check that fails if it breaks, tests ride with
  their code, fixtures widen through their declaration. A test asserting the
  implementation back to itself counts as none.
- **QA** — acceptance criteria met, **Out of scope** respected, edges exercised: empty,
  absent, zero, negative, multiclass, a homebrew row shadowing a catalog one.
- **Editor** — the prose the change writes: commit message, pull request body, `docs/`, a
  skill, a comment. Take it through `writing-clearly-and-concisely`, then weigh what that
  cannot: a sentence ambiguous rather than dense, and a register that fits its reader —
  instructions an agent rereads every pass, in the voice a developer writes, not a
  technical writer. A comment restating the code is a finding. History and markers are
  fenced everywhere but the commit message and the pull request body, where they belong.

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
- **Derived fields store computed, manual and an override flag.** One number lets a
  level-up stomp an edit.
- **`roll_log` and `undo_log` are bounded and pruned on insert**, to `CLAUDE.md`'s
  numbers. A skipped prune grows the table without limit.
- **An unknown `{@tag}` degrades to plain text.** A throw takes the sheet down.
- **`rules` takes primitives, never a `CharacterDefinition`.** Wanting the whole
  character makes it a projection.
- **Replacing an approach deletes the old one.** `knip` finds an abandoned file, not a
  second reachable path.

## What a finding says

```
packages/rules/src/spell-slots.ts:42  critical
A multiclass caster's slots read the highest class level rather than the sum.
A level 3 cleric and level 3 wizard get 2nd-level slots instead of 3rd.
```

| Severity | Means |
|---|---|
| `critical` | Wrong at runtime, or misleading about what the code does |
| `warning` | Contradicts `CLAUDE.md`, `CONTRIBUTING.md` or a skill |
| `comment` | Neither — a taste call, reported once |

A finding naming no line goes against the file or the pull request. Only `comment`
findings left ends the loop.

## What this skill will not do

**Touch the caller's tree.** A checkout there strands step 11 on a detached HEAD, where
the branch-name hook goes quiet and a commit lands anywhere.

**Apply findings, or label the pull request.** Steps 10 to 13 of
[`issue-to-pr`](../issue-to-pr/SKILL.md) do that.

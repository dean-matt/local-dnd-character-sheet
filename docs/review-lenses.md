# Review lenses

What a review of a pull request here weighs, beyond what `pnpm check` and the `tests/*-shape`
suites already assert. The reviewer skips formatting, import order, annotations, line length
and a file over a cap, and judges the subject.

## On every pull request

- **Senior engineer** — the ladder in `CLAUDE.md`: need it, exists here already, one line.
  Package boundaries, and the root cause over the path the issue named.
- **Tester** — non-trivial logic leaves a check that fails if it breaks, tests ride with
  their code, fixtures widen through their declaration. A test asserting the implementation
  back to itself counts as none. A web test's waits meet the review list in
  [`test-waits.md`](test-waits.md#for-review).
- **QA** — acceptance criteria met, **Out of scope** respected, edges exercised: empty,
  absent, zero, negative, multiclass, a homebrew row shadowing a catalog one.
- **Editor** — the prose the change writes: commit message, pull request body, `docs/`, a
  skill, a comment. A comment restating the code is a finding, and history and markers
  belong in the commit message and the pull request body alone.

## Where the diff reaches them

| Lens | Fires on | Weighs |
|---|---|---|
| Rules lawyer | `packages/{rules,character,dice,tags}` | Whether the arithmetic is what 5e says, whether the `classic` and `one` split holds, and the token contract the `tag-render` skill states |
| Data steward | `packages/content` | What the `content-import` skill states: identity keys, edition tiers, `_copy` resolution, the lockfile, and interpolation in the raw SQL |
| API contract | `packages/api` | What the `add-endpoint` skill states: the Zod to OpenAPI to Drizzle to query-hook order, spec drift, a migration that cannot be rerun |
| UI and accessibility | `packages/web` | Semantics, keyboard reachability, contrast, and one concept per `lib/` file against [`code-organization.md`](code-organization.md), since no test can judge it |

A lens returning nothing is the common case.

## Invariants no test asserts

Each fails as a plausible wrong answer rather than an error:

- **`(name, source)` keys every content entity**, and a character references rather than
  copies one. Name alone collides across books.
- **Three databases.** `content.db` is read-only, rebuilt, never migrated, raw SQL;
  `characters.db` and `homebrew.db` take Drizzle migrations. The next build discards
  anything written to `content.db`.
- **Derived fields store the computed value beside a nullable manual one.** One number lets
  a level-up stomp an edit.
- **`roll_log` and `undo_log` are bounded and pruned on insert.** A skipped prune grows the
  table without limit.
- **An unknown `{@tag}` degrades to plain text.** A throw takes the sheet down.
- **`rules` takes primitives, never a `CharacterDefinition`.** Wanting the whole character
  makes it a projection.
- **Replacing an approach deletes the old one.** `knip` finds an abandoned file, not a
  second reachable path.

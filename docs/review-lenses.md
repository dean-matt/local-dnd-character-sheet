# Review lenses

What a review here adds to the plugin's general lenses. The reviewer skips what `pnpm check`
and the `tests/*-shape` suites already assert.

## Added to the general lenses

The plugin's reviewer runs engineer, tester, QA and editor on every pull request. Here:

- **Tester** also applies the review list in [`test-waits.md`](test-waits.md#for-review) to
  a web test's waits, and treats fixtures that widen outside their declaration as no test.
- **QA** adds these edges: multiclass, and a homebrew row shadowing a catalog one.

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

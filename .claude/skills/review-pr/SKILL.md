---
name: review-pr
description: Review a pull request in this repository through the lenses it actually needs — the coding ladder, test depth, the issue's own criteria, and the 5e, catalog, API and accessibility judgments that fire only where the diff reaches them. Use when reviewing a pull request here, from issue-to-pr or by hand. Skips everything pnpm check and the shape tests already assert.
---

# Reviewing a pull request

`CONTRIBUTING.md` holds the reasoning: the pattern here is assert it rather than request
it, so most of what a general reviewer looks for is already a failing test. This pass
takes the remainder.

## What a pass never looks for

`pnpm check` and the `tests/*-shape` suites assert types, lint, dead code, spelling, the
comment policy and the document caps, and every one of them fails before a pull request
exists. A finding there is either already red or already wrong. So say nothing about
formatting, import order, a missing annotation, a line length, a ticket key in a comment,
or a file over a cap — and leave that coverage out later too.

`CONTRIBUTING.md` names the two judgments no fence can make: whether an abstraction is
warranted, and how many tests a piece of logic deserves. Those are this pass's subject.

## What to read

```bash
gh pr view <n> --json title,body,files
gh pr diff <n>
```

Read the issue the body closes. Its acceptance criteria and **Out of scope** are what
the QA lens weighs against, and nothing else states them.

Count the generated files rather than reading them line by line:
`tests/fixtures/5etools/`, `pnpm-lock.yaml`, `content.lock.json`, and anything under
`dist/`. A fixture is wrong only where its declaration is wrong, so read
`packages/content/src/fixtures/declaration.ts` instead of the rows it wrote.

## The lenses

Three run on every pull request, because every change is subject to them:

**Senior engineer** — the ladder in `CLAUDE.md`. Did this need to exist, does it already
exist here, does an installed dependency do it, can it be one line. Package boundaries
hold, and the root cause is fixed rather than the path the issue named — one shared
function, not every caller.

**Tester** — test depth. Non-trivial logic leaves behind the smallest runnable check that
fails if it breaks; tests ride with the code they cover; a fixture is widened in its
declaration rather than by hand. A test that asserts the implementation back to itself
counts as none.

**QA** — the change against its issue. Every acceptance criterion met, **Out of scope**
respected, and the edges exercised: empty, absent, zero, negative, the multiclass case,
the homebrew row that shadows a catalog one.

The rest fire only where the diff reaches what they read, so a `repo`-only change runs
three lenses rather than seven:

| Lens | Fires on | Weighs |
|---|---|---|
| Rules lawyer | `packages/{rules,character,dice,tags}` | Whether the arithmetic is what 5e says, and whether the `classic` and `one` split holds |
| Data steward | `packages/content` | What [`content-import`](../content-import/SKILL.md) states: identity keys, edition tiers, `_copy` resolution, the lockfile, and interpolation in the raw SQL that builds the catalog |
| API contract | `packages/api` | What [`add-endpoint`](../add-endpoint/SKILL.md) states: the Zod to OpenAPI to Drizzle to query-hook order, spec drift, and a migration that cannot be rerun |
| UI and accessibility | `packages/web` | Semantics, keyboard reachability, contrast — what the `accessibility` label marks |

A lens returning nothing is the common case rather than a failure. Where a diff touches
a `{@tag}`, [`tag-render`](../tag-render/SKILL.md) holds the token contract the rules
lawyer reads.

## The invariants no test asserts

Each of these fails as a plausible wrong answer rather than as an error, which is why a
reader has to catch it:

- **Every content entity is keyed `(name, source)`**, never name alone, and a character
  references a catalog row by that key rather than copying it. Features, subraces,
  deities and cards key on more; `docs/data-model.md` holds those.
- **The three-database rule.** `content.db` is read-only, rebuilt wholesale, never
  migrated, and reached through raw SQL; `characters.db` and `homebrew.db` are Drizzle
  and are migrated. Anything durable written to `content.db` is lost on the next build.
- **A derived character field stores the computed value, the manual one and an override
  flag.** A field that stores one number means a level-up stomps a user's edit.
- **`roll_log` and `undo_log` are bounded** at 200 and 50 rows per character, pruned on
  insert. An insert path that skips the prune grows an unbounded table.
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
| `bug` | Wrong at runtime, or a reader is misled about what the code does |
| `repo` | Contradicts a rule in `CLAUDE.md`, `CONTRIBUTING.md` or a skill |
| `preference` | Neither — a taste call, reported and not argued |

Report a finding that names no line against the file or the pull request instead of
dropping it. A pass returning only `preference` findings ends the loop.

## What this skill will not do

**Review anything but a pull request diff.** Not the working tree, not a branch, not a
path. `/code-review` takes those and stays available to type by hand.

**Apply what it finds, or label the pull request.** The pass returns findings; steps 11
to 13 of [`issue-to-pr`](../issue-to-pr/SKILL.md) decide what happens to them.

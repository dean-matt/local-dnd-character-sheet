# Contributing

This file holds the *reasoning* behind rules that are asserted mechanically elsewhere.
The tests in `tests/` say what the rules are; this says why they exist, so that nobody —
human or agent — deletes a fence without understanding what it was holding back.

## Getting set up

Prerequisites and the setup commands are in [`README.md`](README.md). Two things it does
not explain:

`pnpm content:sync` fetches roughly 109 MB of 5etools JSON into `vendor/5etools/`, which
is gitignored. That data is copyrighted by Wizards of the Coast and is never committed or
redistributed here — see [`NOTICE`](NOTICE). Every contributor fetches it themselves.

`.vscode/settings.json` and `.vscode/extensions.json` are committed; everything else under
`.vscode/` is ignored. The one setting that matters is `editor.defaultFormatter` pointing at
Biome — without it, a Prettier install reformats on save, `pnpm lint` disagrees, and the
pre-commit hook rejects the result with no obvious cause. Keep personal preferences such as
theme and font in your user settings rather than here.

`content.lock.json` pins the upstream tag and a SHA-256 for every fetched file. Files are
copied byte-for-byte, so a lock hash equals the upstream file's hash and a mismatch means
a real upstream change or a corrupt fetch. Run `pnpm content:sync --verify` to check.

## Branching and commits

Branches are cut from an issue, so the work and the reason for it stay linked, and are
named `<type>/<issue>-<slug>` — the same type vocabulary the commits use:

```bash
gh issue develop 12 --name feat/12-spell-slot-lookup --checkout
```

`scripts/branch-name.mjs` rejects anything else on pre-commit, because a branch name is
free to change right up until the first commit and awkward afterwards. It also rejects
committing on `main`, and stays quiet on a detached HEAD so a rebase or a bisect still
works.

Direct pushes to `main` are rejected by a repository ruleset. Everything lands through a
pull request, including your own. Approvals are set to zero — GitHub does not let you
approve your own pull request, so requiring one would deadlock a solo repository. Raise
it to one the day a second person joins.

Commits follow [Conventional Commits](https://www.conventionalcommits.org), enforced by
`commitlint` on `commit-msg`. Types are `feat`, `fix`, `chore`, `docs`, `refactor`,
`test`, `perf`, `build`, `ci`, `revert`, and `style`; scopes are `shared`, `content`, `api`,
`web`, `docs`, `repo`, or `deps`. The branch takes the type of the change it carries, so
a branch of fixes is `fix/...` even where one commit inside it is a `test`.

```
feat(content): resolve _copy chains when importing classes
fix(api): correct spell slot lookup for multiclass casters
```

AI attribution is kept. A `Co-Authored-By` trailer naming Claude is accurate provenance
for how this repository is built, and this is a personal project with no employer policy
that says otherwise.

## Picking up work

Issues carry an **Out of scope** field. Fill it in. It is the cheapest bloat prevention
available, because it is the only one that operates before the code exists — the
difference between "add a spell filter" and also refactoring the query layer.

Milestones map to the build order: foundations, then the content pipeline, then the API,
then a read-only sheet, then editing, then live play state. Each milestone depends on the
ones above it.

## Maintaining the README

The README is onboarding only — install it, run it, work on it. Everything else has an
authoritative home elsewhere. `tests/readme-shape.test.ts` asserts the shape.

Sections are fixed and ordered: Prerequisites, Getting started, Common commands, Project
structure, Troubleshooting (optional), Further reading, Contributing.

`Architecture`, `Conventions`, `Status`, `Roadmap`, and `Features` are banned headings.
Each was demoted deliberately. Nothing pulls a reader toward an architecture overview
inside a README, so nobody notices when it goes wrong; conventions govern new work rather
than orientation and belong here; status sections attract badges and stale claims.

Reference content goes to `docs/` with a Further reading row. The test fails a `docs/`
file nobody indexed and a row pointing at a file that does not exist, so the index cannot
drift in either direction.

There is deliberately **no line limit**. A long command block or troubleshooting table is
not the problem; a section that belongs in `docs/` is. A cap would push reference content
out of reach and reward denser, worse prose.

## Maintaining CLAUDE.md

`CLAUDE.md` is capped at 150 lines by `tests/claude-md-shape.test.ts`, and the reason it
has a cap when the README does not is that it is read at the start of *every* task. Its
length is a tax on all future work rather than a one-time read.

When it overflows, extract to a skill — do not raise the cap. A skill loads on demand, so
detail that only some tasks need costs nothing on the tasks that do not need it.

The corollary matters just as much: anything that must apply on *every* task cannot be a
skill. That is why the coding disposition lives in `CLAUDE.md` rather than
`.claude/skills/`, and why it is kept to the handful of rules that change what gets
written. It is adapted from [ponytail](https://github.com/DietrichGebert/ponytail) (MIT).
The original is a vendored file imported into `CLAUDE.md`; that arrangement put 53 lines
of every-task instruction outside the 150-line cap, which the cap exists to prevent.

Skills are indexed in `CLAUDE.md`, which is the only limit on how many exist. Capping the
count would punish a project that legitimately grows; making skills compete for a budget
you can see does not. Individual skills are capped at 100 lines and one file each, by
`tests/skill-shape.test.ts` — that is where skill bloat actually shows up.

## Code comments

A comment explains *why*, never *what*. Git already records history and cannot go stale,
so a comment narrating a change duplicates a better source.

`tests/comment-policy.test.ts` rejects ticket keys, issue numbers, change narration, task
markers, and commented-out code. The patterns are deliberately conservative: a false
positive would push someone toward writing no comment at all, which is worse than the
problem being solved.

Module-level documentation is welcome where it clarifies inputs, outputs, or side effects
that a signature does not convey.

A deliberate corner-cut is worth recording in the code rather than an issue: name the
ceiling and the upgrade path, because that is a *why*. Write it as an ordinary comment.

No marker prefix on it. A label tells a reader nothing the sentence does not, and it
invites itself onto comments with no ceiling to name — a labelled comment reads as
sanctioned. `tests/comment-policy.test.ts` rejects `ponytail:`, the one such label this
repository has carried.

## Working with Claude here

The document rules above exist because prose asking for concision does not hold. That is
not a hypothesis: the README fence in this repository is modelled on one written after a
README reached 779 lines under a style guide that already asked for brevity.

So the pattern throughout is: **assert it, do not request it.** `knip` finds abandoned
files and unused dependencies, which is the residue of an agent changing direction
mid-task. `noUnusedLocals` and Biome's complexity rules catch the rest. The fences run in
`pnpm check`, on pre-commit, and in CI.

What is deliberately *not* mechanized: whether an abstraction is warranted, and how many
tests a piece of logic deserves. A test-count ceiling would discourage tests worth having,
and a line budget on code punishes a long correct function the same as a short pointless
abstraction. Those stay with the coding disposition in `CLAUDE.md` and review on the
pull request.

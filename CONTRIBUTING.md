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

`tests/fixtures/5etools/` is generated from `vendor/` by `pnpm fixtures:build`, and is
committed so that a checkout with no `vendor/` still runs the whole suite. Never edit a
fixture by hand: three separate changes found values in them that upstream never shipped,
and a hand-edited fixture is a test asserting against a number nobody can source. Widen
coverage by naming another entry, field or column in
`packages/content/src/fixtures/declaration.ts` and rebuilding.

Rules prose is elided on the way through, because that text is WotC's and is never
committed. Inside a prose field every string goes, wherever it sits, except the keys a
loader reads — an element's name and type, a `_mod` operand, a link's target. `{@tag}`
and `{{variable}}` markup survives, so a fixture still exercises tag handling and version
templating. What is left committed is names, sources, page numbers and table numbers.

Where a test needs a value upstream cannot supply, the declaration carries an override
that says why — and those are meant to stay countable on one hand.

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

A branch ends when its issue does. `gh pr merge <n> --squash --delete-branch` merges it,
deletes it here and on the remote, and leaves you on `main`. The repository has
`delete_branch_on_merge` set as well, so a merge through the web UI still cleans up, and
`fetch.prune` drops the stale `origin/` ref on the next fetch. Nothing reaps a branch
that never became a pull request — delete those by hand.

A pushed commit is never rewritten. Amending or rebasing one already on the remote lands
only as a force push, which discards the commit a reviewer read — the comment anchored to
a line, the CI run and every permalink now point at nothing. Add a commit instead; the
squash merge collapses them anyway.

On `pre-push`, `scripts/no-rewrite.mjs` rejects a non-fast-forward push of the branch
you are on — a force push aimed at another branch from somewhere else goes through, as
its module comment records. Amending
a commit you have not pushed yet costs a reader nothing and leaves no trace for a hook to
find, so the fence holds only the half it can judge — but add a commit there too, rather
than keeping two habits.

Commits follow [Conventional Commits](https://www.conventionalcommits.org), enforced by
`commitlint` on `commit-msg`. Types are `feat`, `fix`, `chore`, `docs`, `refactor`,
`test`, `perf`, `build`, `ci`, `revert`, and `style`; scopes are `rules`, `character`,
`dice`, `tags`, `content`, `api`,
`web`, `docs`, `repo`, or `deps`. The branch takes the type of the change it carries, so
a branch of fixes is `fix/...` even where one commit inside it is a `test`.

```
feat(content): resolve _copy chains when importing classes
fix(api): correct spell slot lookup for multiclass casters
```

A commit carries one concern. Tests and fixtures ride with the code they cover, and a
stale-doc correction rides with the change that made it stale — the same rule
`CLAUDE.md` sets for itself. The squash merge means `main` gets one commit per pull
request whatever the branch looks like, so this is for the reviewer stepping through it,
not for the history.

Nothing mechanizes this: no lint can tell one concern from two, and a commit-count
ceiling would punish a branch that genuinely is one change.

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
`.claude/skills/`, kept to the handful of rules that change what gets written, and why it
is written inline rather than imported from a vendored file — an import puts every-task
instruction outside the cap that exists to bound it. Adapted from
[ponytail](https://github.com/DietrichGebert/ponytail) (MIT).

A skill is named for the job rather than the obvious verb, checked against what is
installed on the machine. Namespacing keeps an explicit invocation unambiguous, but a
request in prose picks between two similar descriptions, so a skill here called
`work-issue` would compete with any plugin that owns the name. This repository's is
`issue-to-pr` for that reason.

Editing one earns a `writing-clearly-and-concisely` pass before it is committed, which an
ordinary file does not. A skill is the prose read at the start of every task it governs,
so an ambiguous sentence misroutes the work rather than merely reading badly.

Skills are indexed in `CLAUDE.md`, which is the only limit on how many exist. Capping the
count would punish a project that legitimately grows; making skills compete for a budget
you can see does not. `tests/skill-shape.test.ts` caps each `SKILL.md` at 150 lines, which
is where skill bloat shows up. The cap matches `CLAUDE.md`'s, because a skill that drives
a whole workflow carries about as much as the file that indexes it.

A skill may carry reference documents beside its `SKILL.md`. Banning the second file is
the weaker proxy and costs more than it holds: detail only one skill needs then has
nowhere to go but `docs/`, where it sits beside reference a human reads, takes a README
row, and is indexed for tasks that will never cite it. What produces a thousand lines is a
file with no subject, so the fence sits on the names and the links instead;
`tests/skill-shape.test.ts` holds which. Each document is cited at the step that needs it
rather than in a closing list, because one the agent skips is worse than prose written
inline.

The boundary with `docs/` needs its own rule, or the two blur. A `docs/` file is cited
from more than one place, or by a task that runs no skill; a skill reference is read only
when its skill runs. That makes the second `SKILL.md` to link a file the signal that it
belongs in `docs/`.

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

A comment that survives all of that is read on every visit afterwards, so it earns the
same edit as any other prose: active voice, positive form, needless words out. Three
faults recur. A passive naming no actor — "the table is read with this level" hides who
reads it, where "the level that reads the table" does not. A negative standing in for a
positive — "the display argument is not uniform" leaves a reader to work out what it is
instead. A clause padding a noun into a sentence — "which is a choice worth auditing" is
"a choice worth auditing".

The edit has one failure mode, worse than the wordiness it removes: "omit needless words"
becomes "omit words", and the clause carrying the only *why* goes with them. A declined
alternative reads like padding and is not — "rejected rather than reinterpreted" says a
choice was made, where "throws a `TypeError`" only repeats the signature. So compare the
claims and not the prose: every fact a comment asserted before the edit is asserted after
it, and a claim that turns out to belong in the signature moves there instead of going.

Nothing asserts this and nothing can: every proxy for wordiness flags good comments too.
Edit for what the rewrite turns up rather than the words it saves — a comment that resists
compression is usually ambiguous, and the edit is where that shows.

## Working with Claude here

The document rules above exist because prose asking for concision does not hold. That is
not a hypothesis: the README fence in this repository is modelled on one written after a
README reached 779 lines under a style guide that already asked for brevity.

So the pattern throughout is: **assert it, do not request it.** `knip` finds abandoned
files and unused dependencies, which is the residue of an agent changing direction
mid-task. `noUnusedLocals` and Biome's complexity rules catch the rest. The fences run in
`pnpm check`, on pre-commit, and in CI.

CI splits by what a check needs to read. Everything that reads only committed data runs
on every pull request; `check` runs on Linux and Windows, the rest on Linux alone. The
`corpus` job reads `vendor/` and fetches 109 MB to do it, so it waits for a change to
`content.manifest.json`, `content.lock.json` or the workflow itself — or for a
`workflow_dispatch`, which is how a loader or fixture-declaration change reaches it. A
tag bump is the event it exists for: that is the one change that can leave the lockfile
and the committed fixtures each describing a different upstream.

What is deliberately *not* mechanized: whether an abstraction is warranted, and how many
tests a piece of logic deserves. A test-count ceiling would discourage tests worth having,
and a line budget on code punishes a long correct function the same as a short pointless
abstraction. Those stay with the coding disposition in `CLAUDE.md` and review on the
pull request.

---
name: open-pr
description: Open the pull request for one local-dnd-character-sheet issue and write its body — `gh pr create`, `Closes #<issue>` first line, what changed, and the verification that ran. Use from `issue-to-pr` once a branch is pushed and ready for review; cite it, rather than restate it, from anywhere else that reads or rewrites a pull request body.
---

# Opening a pull request

Open it with `gh pr create`, body written to the format below. This starts CI; the pushes
before it started nothing. A diff that changes `docs/mockup/components/` adds `--draft`,
whoever runs it: [Changing a mockup](../../../docs/mockup/README.md#changing-a-mockup)
marks it ready once the canvas carries the change.

## The version

A pull request that changes code raises the root `package.json` version over `main`'s,
once: `feat` raises the minor, every other type the patch.

```bash
npm version <minor|patch> --no-git-tag-version
```

`pnpm check` fails a branch without it, so `issue-to-pr` commits the bump with its first
commit, before this skill runs. Where `main` raises it while the pull request is open,
[`merge-pr`](../merge-pr/SKILL.md#where-the-branch-is-behind) raises it again.

## The pull request body

`Closes #<issue>` on the first line. Then what the change does and, for anything a reviewer
would otherwise derive, the entry in the data that decided it as `Name` (SOURCE). Close
with the verification: "`pnpm check` is green" is the floor, so say what ran against the
real corpus and what came out. A mockup change adds its `Canvas:` line, naming the link
and the version the files were published as.

## What this skill will not do

**Decide what to write.** The issue and the diff say what changed; this skill says only how
to shape it into a first line, a body and a verification line that `merge-pr` can parse
back out.

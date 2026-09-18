---
name: issue-worktree
description: Open and close the git worktree an issue is built in — branch it off the issue, install and symlink what a checkout needs, then later remove it without discarding anything left uncommitted. Use from `issue-to-pr` to open one and to close it when a run ends without merging, and from `merge-pr` to close it once a pull request merges.
---

# The issue worktree

## Opening

Enter it with `cd`, not the harness's worktree tool, which refuses every `git` call a shell
wrapper rewrites.

```bash
main=$(git rev-parse --show-toplevel); b=<type>/<n>-<slug>; d=.claude/worktrees/<n>
gh issue develop <n> --name "$b"
git fetch --quiet origin "$b"
git worktree prune
git worktree add --quiet "$d" "$b"
cd "$d" && pnpm install --frozen-lockfile && mkdir -p vendor
for p in vendor/5etools data/content.db .claude/settings.local.json; do
  [ -e "$main/$p" ] && ln -sfn "$main/$p" "$p"
done
```

The add fails where a directory is already there — another agent on this issue, or a crash.
Clear it by hand once no agent holds it. Never link `characters.db`: two agents writing it
collide. Run every later step from the worktree.

## Closing

From inside the worktree, `cd "$(git rev-parse --show-toplevel)/../../.."` reaches the main
checkout first — `git worktree remove` runs from outside the tree it removes.

```bash
git worktree remove .claude/worktrees/<n>
git worktree prune
```

`git worktree remove` refuses rather than discarding anything left uncommitted; stop on that
refusal rather than forcing it. The branch and any open pull request stand — this closes
only the checkout.

## What this skill will not do

**Decide when to close.** `issue-to-pr` closes on its own stop, whatever the review left
outstanding; `merge-pr` closes after merging, and deletes the branch itself once the
worktree holding it is gone.

---
name: issue-worktree
description: Claim an issue and open the git worktree it is built in — create its branch as the claim, assign it, install and symlink what a checkout needs — then later remove the worktree without discarding anything left uncommitted, or release a claim no pull request followed. Use from `issue-to-pr` to claim and open, to release and to close when a run ends, and from `merge-pr` to close it once a pull request merges.
---

# The issue worktree

## Claiming

Creating the branch is the claim. The branch name derives from the issue, so two sessions
claiming one issue create the same ref, and GitHub refuses the second with
`Reference already exists (HTTP 422)`. Never claim with `gh issue develop`: it exits 0 on a
branch already linked to the issue, so both sessions win. A title or label edited since an
earlier claim derives a different name, so the claim first refuses on any branch already
named for the issue.

```bash
n=<n>
if git ls-remote --exit-code --heads origin "*/$n-*"; then echo held; else
  b=$(gh issue view "$n" --json number,title,labels --jq '"\(([.labels[].name
    | select(startswith("type:")) | ltrimstr("type:")] + ["chore"])[0])/\(.number)-\([.title
    | ascii_downcase | scan("[a-z0-9]+")][0:5] | join("-") | if . == "" then "issue" else . end)"')
  sha=$(gh api 'repos/{owner}/{repo}/git/ref/heads/main' --jq .object.sha)
  gh api 'repos/{owner}/{repo}/git/refs' -f ref="refs/heads/$b" -f sha="$sha" --silent
fi
```

Where that prints `held`, or the create exits 1 with the 422, the issue is held: a picked
issue goes to the next one `pick-issue` returned, and a named issue stops with the holder,
`gh issue view "$n" --json assignees --jq '[.assignees[].login] | join(",")'`, or the
branch name where nobody is assigned yet. The holder can be you: a branch an earlier run of
yours left. Otherwise assign it:

```bash
gh issue edit "$n" --add-assignee @me
```

Two claims racing on one issue resolve to one holder. This probe shows it, then deletes
the branch it made. It names issue `0`, which no issue carries, so it claims no real work:

```bash
t=chore/0-claim-probe; sha=$(gh api 'repos/{owner}/{repo}/git/ref/heads/main' --jq .object.sha)
for i in 1 2; do (gh api 'repos/{owner}/{repo}/git/refs' -f ref="refs/heads/$t" -f sha="$sha" \
  --silent 2>/dev/null; echo "claim $i exit $?") & done; wait
gh api -X DELETE "repos/{owner}/{repo}/git/refs/heads/$t"
```

One claim prints exit 0 and the other exit 1.

## Opening

`b` is the claimed branch, or the pull request's `headRefName` when `merge-pr` reopens a
worktree. Enter it with `cd`, not the harness's worktree tool, which refuses every `git`
call a shell wrapper rewrites.

```bash
main=$(git rev-parse --show-toplevel); n=<n>; b=<branch>; d=.claude/worktrees/$n
git fetch --quiet origin "$b"
git worktree prune
git worktree add --quiet "$d" "$b"
cd "$d" && pnpm install --frozen-lockfile && mkdir -p vendor
for p in vendor/5etools data/content .claude/settings.local.json; do
  [ -e "$main/$p" ] && ln -sfn "$main/$p" "$p"
done
```

The add fails where a directory is already there — another agent on this issue, or a crash.
Clear it by hand once no agent holds it. Never link `characters.db`: two agents writing it
collide. Run every later step from the worktree.

## Releasing

A run that stops before its pull request opens releases the claim, so `pick-issue` does not
skip the issue as a build in flight. Run it after closing the worktree. It deletes the
branch only where neither copy carries a commit beyond `main`, and a missing local copy
counts as none; a branch with work on it
stays for the user to weigh.

```bash
n=<n>; b=<branch>; git fetch --quiet origin main
[ "$(gh api "repos/{owner}/{repo}/compare/main...$b" --jq .ahead_by)" = 0 ] &&
  [ "$(git rev-list --count "origin/main..$b" 2>/dev/null || echo 0)" = 0 ] &&
  git push --quiet origin --delete "$b" && { git branch -D "$b" 2>/dev/null; true; }
gh issue edit "$n" --remove-assignee @me
```

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

**Decide when to close or release.** `issue-to-pr` closes on its own stop, whatever the
review left outstanding, and releases where no pull request opened; `merge-pr` closes after
merging, and deletes the branch itself once the worktree holding it is gone.

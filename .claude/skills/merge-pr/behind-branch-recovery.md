# Recovering a branch behind `main`

Reached from *Where the branch is behind* in [SKILL.md](SKILL.md), where the gate answers
`BEHIND`. `$n` is the pull request number.

## Update the branch on the server

```bash
gh api --method PUT "repos/{owner}/{repo}/pulls/$n/update-branch" --jq .message
```

That merges `main` in on the server and leaves every pushed commit alone; never rebase or
force push instead. A 422 of `There are no new commits on the base branch` means the branch
is already current, so carry on to the wait. Any other 422 is a conflict the update left
untouched, and resolving one is a code decision this skill does not make: hand it over.

## Wait out both windows

The call answers 202 and queues the merge, so two windows each give a verdict for the wrong
commit — the old commit's green checks until the head carries `main`, then no checks at all,
which `--watch` exits on and the gate reads as green.

```bash
for _ in $(seq 10); do
  sleep 10
  head=$(gh pr view "$n" --json headRefOid --jq .headRefOid)
  git fetch --quiet origin main "$head"
  git merge-base --is-ancestor origin/main "$head" &&
    gh pr checks "$n" --json name --jq 'length > 0' 2>/dev/null | grep -q true &&
    { echo ready; break; }
done
```

The loop carries nothing from the block above and fits a default tool timeout, so reinvoke
it where a run ends without `ready`. Three such runs go to the user, naming the stuck
window: `--is-ancestor` failing means the update never landed, passing with no checks means
GitHub scheduled nothing.

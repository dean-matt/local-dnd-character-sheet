---
name: merge-pr
description: Carry one reviewed local-dnd-character-sheet pull request to main — block on CI, test the merge gate, squash-merge, then delete the branch and its worktree, move the board to Done and leave the checkout on an up-to-date main. Use when asked to merge, land or ship a pull request here. Stops and names the condition where any part of the gate fails.
---

# Merging a pull request

[`issue-to-pr`](../issue-to-pr/SKILL.md) labels a pull request and stops, on purpose. This
is the separate invocation that lands it. Run every command from the main checkout: a
worktree holds its branch, and the merge deletes it.

```bash
n=<pr>
gh pr view "$n" --json state,isDraft,url,headRefName
issue=$(gh pr view "$n" --json body --jq '.body | capture("Closes #(?<i>[0-9]+)").i')
```

An open, non-draft pull request naming the issue it closes is the input. Anything else
stops here.

## Block on the checks

`gh pr checks` answers with whatever it knows now, so waiting is this skill's job. Rerun a
red run once and no more — a flaky runner costs one rerun, and a second says the failure is
the branch's.

```bash
deadline=$(( $(date +%s) + 1800 ))
rerun=1
while :; do
  json=$(gh pr checks "$n" --json bucket,link 2>/dev/null)
  pending=$(printf %s "$json" | jq '[.[] | select(.bucket == "pending")] | length' 2>/dev/null)
  if [ "${pending:-1}" -gt 0 ]; then
    [ "$(date +%s)" -lt "$deadline" ] || { echo "timed out waiting on the checks"; break; }
    sleep 30; continue
  fi
  red=$(printf %s "$json" | jq -r '[.[] | select(.bucket == "fail" or .bucket == "cancel")
    | .link | capture("/runs/(?<id>[0-9]+)").id] | unique | .[]')
  [ -n "$red" ] || break
  [ "$rerun" = 1 ] || { echo "still red after a rerun: $red"; break; }
  rerun=0
  printf '%s\n' "$red" | while read -r id; do gh run rerun "$id" --failed; done
  sleep 30
done
```

`jq` prints nothing where `gh` gave it nothing — checks that have yet to register — and
`${pending:-1}` reads that as one still to come rather than none left. Thirty minutes outlasts
the slowest run here, and the sleep covers the seconds a rerun takes to show as pending.

## The gate

The loop ends on green, on a timeout, or on a second red run, and the first condition below
tells those apart. Merge only where all five hold; where one fails, name it and stop.

**Every check is green.** A `pending` left after the wait is a timeout, not a pass.

```bash
gh pr checks "$n" --json name,bucket --jq '[.[] | select(.bucket != "pass" and .bucket != "skipping")]'
```

**The last review pass returned no `critical`, no `warning` and nothing unreadable.** A pass
is a review carrying a body; the replies `issue-to-pr` posts land as reviews with none. Read
the body too: a finding no line anchors is written there rather than on a comment.

```bash
sev='capture("^\\*\\*(?<s>critical|warning|comment)\\*\\*").s // "unreadable"'
pass=$(gh api --paginate "repos/{owner}/{repo}/pulls/$n/reviews" --jq '[.[] | select(.body != "")] | last | .id')
gh api "repos/{owner}/{repo}/pulls/$n/reviews/$pass" --jq .body
gh api --paginate "repos/{owner}/{repo}/pulls/$n/reviews/$pass/comments" --jq '[.[] | select((.body | '"$sev"') != "comment") | .html_url]'
```

**Every thread carries a verdict, and no declined finding is `critical` or `warning`.** A
declined `comment` is a taste call refused, which is how a healthy review ends; anything else
is a judgment the user has not seen. The first query returns the threads still waiting on a
reply, the second the declines that go to the user. Both come back empty.

```bash
c="repos/{owner}/{repo}/pulls/$n/comments"
gh api --paginate "$c" --jq '[.[]] | (map(select(.in_reply_to_id == null) | .id))
  - (map(select(.body | test("^\\*\\*(Applied|Declined)\\*\\*")) | .in_reply_to_id))'
gh api --paginate "$c" --jq '[.[]] | (map(select(.in_reply_to_id == null)) | INDEX(.id | tostring)) as $f
  | map(select((.body | test("^\\*\\*Declined\\*\\*")) and (($f[.in_reply_to_id | tostring].body // "" | '"$sev"') != "comment")) | .html_url)'
```

`$sev` is the marker [`audit-pr`](../audit-pr/SKILL.md) writes, and both conditions read it
through that one expression. A body it cannot parse becomes `unreadable`, which the filter
keeps rather than drops. `tests/review-severity.test.ts` holds it to `audit-pr`'s whole table.

**The diff reaches no fenced path.** Each is a file where a wrong merge costs more than the
wait: the schema of a precious database, what the ETL fetches, the documents that govern
every later task, what CI runs, the instructions an agent rereads, and the dependency tree.

```bash
head=$(gh pr view "$n" --json headRefOid --jq .headRefOid)
git fetch --quiet origin main "$head"
base=$(git merge-base origin/main "$head")
git diff --name-only "$base" "$head" | grep -E \
  '^(CLAUDE|CONTRIBUTING)\.md$|^content\.(lock|manifest)\.json$|^\.github/|^\.claude/skills/|^packages/api/drizzle/'
deps() { git show "$1:$2" 2>/dev/null | jq -S '{dependencies,devDependencies,peerDependencies,optionalDependencies,pnpm}'; }
git diff --name-only "$base" "$head" | grep -E '(^|/)package\.json$' | while read -r f; do
  [ "$(deps "$base" "$f")" = "$(deps "$head" "$f")" ] || echo "$f"
done
```

`packages/api/drizzle/` is where both `drizzle.config.ts` files write, and
`tests/merge-gate.test.ts` fails where either leaves it. Comparing parsed dependency maps
rather than the diff lets a version bump stop the merge while a rename or a reordered script
does not.

**The branch merges cleanly.** A `mergeable` of `CONFLICTING`, or a `mergeStateStatus` of
`DIRTY`, stops the run — resolving it is the user's. `UNKNOWN` means GitHub is still
computing one, so ask again.

```bash
gh pr view "$n" --json mergeable,mergeStateStatus
```

## Merge, then clean up

Remove the worktree first, or `gh` cannot delete the branch it holds. The board's workflow
may reach `Done` unaided, and setting it again changes nothing.

```bash
wt=".claude/worktrees/$issue"; [ -e "$wt" ] && { git worktree remove "$wt" || exit 1; }
git worktree prune
gh pr merge "$n" --squash --delete-branch
git checkout main && git pull --ff-only

statusField=$(gh project field-list 1 --owner dean-matt --format json --jq '.fields[] | select(.name == "Status")')
gh project item-edit \
  --id "$(gh project item-add 1 --owner dean-matt --url "$(gh issue view "$issue" --json url --jq .url)" --format json --jq .id)" \
  --project-id "$(gh project view 1 --owner dean-matt --format json --jq .id)" \
  --field-id "$(printf %s "$statusField" | jq -r .id)" \
  --single-select-option-id "$(printf %s "$statusField" | jq -r '.options[] | select(.name == "Done") | .id')"
```

`item-add` returns the item an issue already has. `git worktree remove` refuses rather than
discarding anything uncommitted, and the `exit` makes that refusal stop the run. Then report
the merge commit, the issue it closed, and that the checkout is on `main`.

## What this skill will not do

**Resolve a conflict.** It stops and hands the branch back.

**Waive a condition.** A gate that argues itself open on the merge it is judging is not a
gate. Widening one is an issue against this file.

**Review.** [`audit-pr`](../audit-pr/SKILL.md) does that, and this skill reads what that
pass left behind rather than forming an opinion of its own.

---
name: pick-issue
description: Pick the next local-dnd-character-sheet issue to take when none is named — reads the `D&D Character Sheet` project board, sorts by milestone and rank, skips an issue someone else holds, and applies the backlog and blocked-label rules. Use from `issue-to-pr` when no issue is named. Not a skill to call on its own — a second caller reading the board gives it two readers that can disagree.
---

# Picking the next issue

Say which issue you are taking and which you skipped, then start. The `D&D Character
Sheet` project board decides — not the issue number, not what just merged, not how small
it looks.

```bash
gh api graphql --paginate --slurp -f o=dean-matt -f r=local-dnd-character-sheet -f query='
  query($o:String!,$r:String!,$endCursor:String){viewer{login} repository(owner:$o,name:$r){
    refs(refPrefix:"refs/heads/",first:100){nodes{name}}
    issues(states:OPEN,first:100,after:$endCursor){pageInfo{hasNextPage endCursor}
      nodes{number milestone{title} assignees(first:5){nodes{login}}
        closedByPullRequestsReferences(first:5,includeClosedPrs:false){nodes{number author{login}}}
        linkedBranches(first:5){nodes{ref{name}}}
        projectItems(first:5){nodes{project{number}
          fieldValueByName(name:"Rank"){... on ProjectV2ItemFieldNumberValue{number}}}}}}}}' |
  jq '.[0].data.viewer.login as $me | [.[0].data.repository.refs.nodes[].name] as $refs
    | [.[].data.repository.issues.nodes[] | (.number | tostring) as $n
      | {number, milestone: .milestone.title,
         rank: ([.projectItems.nodes[] | select(.project.number == 1) | .fieldValueByName.number] | first),
         holders: ([.assignees.nodes[].login, .closedByPullRequestsReferences.nodes[].author.login] | unique),
         pr: ([.closedByPullRequestsReferences.nodes[].number] | first),
         branch: ([.linkedBranches.nodes[].ref.name, ($refs[] | select(test("^[a-z]+/" + $n + "-")))] | first)}
      | select(.rank and .milestone)
      | .skip = if .holders - [$me] != [] then "held by \(.holders - [$me] | join(","))"
                elif .pr then null
                elif .branch then "branch \(.branch) has no open pull request"
                else null end]
    | sort_by(.milestone, .rank)
    | {take: [.[] | select(.skip == null) | {number, pr}][0:5], skipped: [.[] | select(.skip) | {number, skip}]}'
```

`--slurp` hands jq every page at once; without it the sort runs per page. The query reads
the open issues and their own cards, never the board: the board holds hundreds of mostly
`Done` cards, and paging them is what hit the secondary rate limit. On a rate-limit error, stop and report; do not retry.
`refs` reads the first 100 branches; past that, a claim on a later branch goes unseen
here and the claim itself still refuses it.

Milestones sort by title, which holds while they are numbered. The repository's
collaborators own the rank order and the milestones, and any of them may rerank or
re-milestone an issue; "the user" here names a collaborator. An unranked or milestone-less
issue is backlog and waits for a collaborator to rank it. An empty `take` means no
milestone holds a ranked open issue nobody else holds: say so and stop.

`take` lists the first five candidates in order; `issue-to-pr` claims the first and moves to
the next where the claim refuses, and runs the query again once all five refuse. The
holders are the assignees and the open pull requests' authors. An issue is skipped where
anyone other than you holds it, or where a branch named for it
has no open pull request — a build in flight, or a stopped run that never released its
claim. An issue whose open pull request you hold is taken: re-picking a stopped run is how
its pull request comes back to the user.

A `blocked` label with no `## Blocked by` and no `## Do not start before` is a flag rather
than a fence — read the issue and say why you are taking it. Where the condition still
holds, stop and name it; reranking is the user's call.

## What this skill will not do

**Take a second caller.** `issue-to-pr` is the only thing that invokes this skill. A skill
that dispatches `issue-to-pr` blind, such as `auto-dev`, must keep doing so rather than
calling this skill itself — two readers of the board can disagree on which issue is next.

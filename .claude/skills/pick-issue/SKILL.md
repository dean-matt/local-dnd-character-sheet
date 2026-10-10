---
name: pick-issue
description: Pick the next local-dnd-character-sheet issue to take when none is named — reads the `D&D Character Sheet` project board, sorts by milestone and rank, and applies the backlog and blocked-label rules. Use from `issue-to-pr` when no issue is named. Not a skill to call on its own — a second caller reading the board gives it two readers that can disagree.
---

# Picking the next issue

Say which issue you are taking, then start. The `D&D Character Sheet` project board
decides — not the issue number, not what just merged, not how small it looks.

```bash
gh api graphql -f o=dean-matt -f r=local-dnd-character-sheet -f query='
  query($o:String!,$r:String!){repository(owner:$o,name:$r){issues(states:OPEN,first:100){
    totalCount nodes{number milestone{title}
      projectItems(first:5){nodes{project{number}
        fieldValueByName(name:"Rank"){... on ProjectV2ItemFieldNumberValue{number}}}}}}}}' |
  jq '.data.repository.issues
    | if .totalCount > (.nodes | length) then error("more than 100 open issues — add an after cursor") else . end
    | [.nodes[] | {number, milestone: .milestone.title, rank: ([.projectItems.nodes[] | select(.project.number == 1) | .fieldValueByName.number] | first)}
      | select(.rank and .milestone)]
    | sort_by(.milestone, .rank) | .[0]'
```

One call that reads the open issues and their own cards, never the board: it holds hundreds of
mostly `Done` cards, and paging them is what hit the secondary rate limit. On a rate-limit
error, stop and report; do not retry.

Milestones sort by title, which holds while they are numbered. An unranked or
milestone-less issue is backlog and waits for the user to name it. `null` means no
milestone holds a ranked open issue: say so and stop.

A `blocked` label with no `## Blocked by` and no `## Do not start before` is a flag rather
than a fence — read the issue and say why you are taking it. Where the condition still
holds, stop and name it; reranking is the user's call.

## What this skill will not do

**Take a second caller.** `issue-to-pr` is the only thing that invokes this skill. A skill
that dispatches `issue-to-pr` blind, such as `auto-dev`, must keep doing so rather than
calling this skill itself — two readers of the board can disagree on which issue is next.

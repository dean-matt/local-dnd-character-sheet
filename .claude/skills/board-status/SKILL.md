---
name: board-status
description: Move one issue's card on the `D&D Character Sheet` project board to a named status — item-add, find the Status field, then item-edit the option. Use from `issue-to-pr` to set `In Progress` and from `merge-pr` to set `Done`.
---

# Setting the board status

```bash
item=$(gh project item-add 1 --owner dean-matt --url <issue-url> --format json --jq .id)
gh project item-edit --id "$item" --project-id PVT_kwHOA3be584BiRmv \
  --field-id PVTSSF_lAHOA3be584BiRmvzhhKPxQ --single-select-option-id <option>
```

Options: `Todo` f75ad846, `In Progress` 47fc9ee4, `Done` 98236657. Two calls per move: the IDs
are fixed, and every dispatched subagent starts fresh, so a lookup per session repeats for
each one. Where `item-edit` says an ID does not exist, the board was rebuilt: read the new IDs
with `gh project view 1 --owner dean-matt --format json --jq .id` and
`gh project field-list 1 --owner dean-matt --format json`, and correct this table.

On "rate limit exceeded", stop and report. Do not retry.

`item-add` returns the item an issue already has, so calling this again on the same issue
changes nothing but the status. Read `project` and `field` once a session; both hold still.

## What this skill will not do

**Decide which status to set.** The caller names it: `issue-to-pr` opens with
`In Progress`, `merge-pr` closes with `Done`.

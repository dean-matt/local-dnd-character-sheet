---
name: board-status
description: Move one issue's card on the `D&D Character Sheet` project board to a named status — item-add, find the Status field, then item-edit the option. Use from `issue-to-pr` to set `In Progress` and from `merge-pr` to set `Done`.
---

# Setting the board status

```bash
item=$(gh project item-add 1 --owner dean-matt --url <issue-url> --format json --jq .id)
project=$(gh project view 1 --owner dean-matt --format json --jq .id)
field=$(gh project field-list 1 --owner dean-matt --format json --jq '.fields[] | select(.name == "Status")')
gh project item-edit --id "$item" --project-id "$project" \
  --field-id "$(printf %s "$field" | jq -r .id)" \
  --single-select-option-id "$(printf %s "$field" | jq -r --arg s "<status>" '.options[] | select(.name == $s) | .id')"
```

`item-add` returns the item an issue already has, so calling this again on the same issue
changes nothing but the status. Read `project` and `field` once a session; both hold still.

## What this skill will not do

**Decide which status to set.** The caller names it: `issue-to-pr` opens with
`In Progress`, `merge-pr` closes with `Done`.

# Data model

Schemas live in code and are the source of truth:
`packages/content/src/schema.ts` for the catalog, `packages/api/src/db/characters.ts`
and `packages/api/src/db/homebrew.ts` for user data, and
`packages/character/src/character.ts` for what the `definition` and `state` JSON columns
hold. This describes the shape and the rules that are not visible in a table definition.

## Shape

```mermaid
erDiagram
    characters ||--|| character_state : "current values"
    characters ||--o{ field_overrides : "manual edits"
    characters ||--o{ roll_log : "last 200"
    characters ||--o{ undo_log : "last 50"
    characters }o--o{ spells : "by (name, source)"
    characters }o--o{ items : "by (name, source)"
    characters }o--o{ homebrew_items : "by id"

    characters {
        text id PK
        text name
        text edition "classic | one"
        int  level
        json definition
    }
    character_state {
        text character_id PK
        json state "hp, slots, conditions, resources"
    }
    field_overrides {
        text character_id FK
        text field
        text value
    }
    spells {
        text name PK
        text source PK
        text edition
        int  level
    }
```

## Rules that are not in the schema

**Reference, never copy.** A character stores `{name: "Fireball", source: "PHB"}`. It
does not store the spell. Rebuilding the catalog updates every character; copying would
freeze each character at the moment it was created.

**Homebrew is the exception.** Nothing else owns it, so `homebrew.db` stores full
records. Rows carry source `HB` and are merged with catalog rows at query time.

**Every content lookup filters on edition.** Both rulesets are present for every class,
spell, and lookup table. A query without an edition filter returns duplicates.

**Overrides are sparse.** An absent `field_overrides` row means "use the computed
value". Writing an override never changes the computed side, and clearing one restores
the computed value rather than a remembered old number.

**Logs are pruned on insert**, in the same statement that writes the new row. A cron job
or a manual cleanup would be one more thing to forget.

## Resource counters

Class resources come from `classTableGroups` where upstream provides them, which is
about 80% of cases — see [`5etools-data.md`](5etools-data.md). The rest are stored as
generic counters:

```
name          "Superiority Dice"
current       3
maximum       4
resets_on     short | long | dawn | manual
```

The same shape holds data-derived resources and user-invented ones, so Battle Master
dice and a homebrew resource need no special casing.

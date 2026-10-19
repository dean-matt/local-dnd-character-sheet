# Skills an item grants

A homebrew item may state `skillProficiencies: [{"intimidation": true}]` and `expertise`, in the
shape a race and a feat use; no catalog item does. `itemSkillGrantsSchema`
(`packages/catalog/src/item-skill.ts`) reads both lists from the row's `json` into lowercased skill
names, and is `undefined` for a row that grants no skill.

## When the grant applies

An item counts while it is equipped, and attuned where it requires attunement. A potion grants
nothing, whatever it states, because its effect lasts as long as the drink and not as long as the
character holds it.

`resolveCharacterCatalog` collects one `ItemSkillTrait` per inventory entry, keyed by `itemKey`, and
`deriveCharacter` folds the equipped ones into the definition beside the skills a feat grants.

## How the skills count

A skill an item grants proficiency in counts on its skill row like any other proficiency, and the
Abilities section lists it under "Granted by items" with the item's name.

Expertise applies only where the wearer is proficient, whether the proficiency comes from the
definition, a feat or another worn item. An item that names a skill under both lists therefore
grants proficiency and expertise together, and an item that names a skill only under `expertise`
changes nothing for a wearer without the proficiency.

## Editing a homebrew item

The homebrew item form edits both lists as skill pickers (`ItemSkillFields.tsx`). A list of
alternatives or a pick (`choose`) cannot be shown as names, so the form says so and leaves it to the
JSON editor.

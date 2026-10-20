# What the wearer picks on an item

## An ability score

Five rows at v2.34.1 let the wearer choose which score rises: `Deck of Many Things` (DMG,
XDMG) writes `ability` as a bare `{from, count, amount}`, and `Book of Vile Darkness` (DMG,
XDMG) and `Deck of Several Things` (LLK) wrap the same object in `choose`. The `BMT` deck
states none. `abilityGrantSchema` (`packages/catalog/src/ability.ts`) reads either form into
the grant's `choose`, and only the first `choose` group, as no row has a second.

An inventory entry stores its pick as `abilityPicks`, a list of scores, on the entry
rather than the item, so two copies pick separately. Only picks the item offers count,
each once and no more than `count`. Each earns `amount`, or 1 where the row states none,
and changes the score as any item grant does, equipped and attuned where required. A
re-pick replaces the list.

Until the picks are made the item grants nothing, and `pendingAbilityPicks` in the derived
block names the entry, the scores it offers and `count`, the total to pick. An unequipped item
with picks unmade still appears, so a player can pick before equipping.

## A proficiency or a language

`grantsProficiency` and `grantsLanguage` are bare `true` flags at v2.34.1: they name no
proficiency or language, and `grantsProficiency` on most weapons flags a tool or a skill. An
inventory entry stores the player's pick, or the one the item's rules text names, as
`proficiencyPick` (a name such as `Longbow`) and `languagePick` (a reference to a language row).
Both sit on the entry, so two copies pick separately, and a pick on an item without the flag
is ignored.

Until the pick is stored the item grants nothing, and `itemGrants.pending` names the entry
(`entry`, `item`, `kind`) so the "Granted by items" card says it waits on a choice. Once
stored, the pick joins `itemGrants.proficiencies` or `itemGrants.languages` with the item as
`from`. It counts while the item is equipped, and attuned where it requires attunement, so
unequipping or un-attuning removes it. Only an item in effect appears as pending.

## Hit points from a Constitution-setting item

The Amulet of Health only sets Constitution, and the maximum follows through the modifier.
The `constitutionItemHitPointsPerLevel` house rule is a number of hit points that each such
item adds at every level, on top of the modifier. It counts while the item is equipped, and
attuned where it requires attunement. The breakdown lists it as a term named for the item,
and a manual maximum still wins. Until the settings page has a control for a number, the
option is written through the definition's `houseRules`.

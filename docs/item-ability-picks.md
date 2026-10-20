# An ability score the wearer picks

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
block names the entry, the scores it offers and how many to pick.

# What can be reversed

Every decision the app stores, where it is written, and the way back from it. Paths are under
`packages/web/src/` unless they name a package. Each sheet edit reaches the API through
`hooks/useUpdateCharacterDefinition.ts`, and `updateCharacterDefinition`
(`packages/api/src/db/queries/characters.ts`) records the definition it replaced in `undo_log`.
Each play-state change reaches it through `hooks/useReplaceCharacterState.ts`, and
`updateCharacterState` records the state it replaced there too. A change to both at once,
`PUT /characters/{id}/definition-and-state` (`updateCharacterAndState`), records one entry of
kind `both` holding the definition and the state it replaced. A roll sent with it, such as an attack that spends ammunition, is logged in the same
write and covered by the entry: undoing it deletes the roll from the roll log. Casting a spell that spends a consumed
component from the inventory writes it through `hooks/useReplaceDefinitionAndState.ts`.

## What Undo reaches

Control+Z (`routes/CharacterLayout/UndoHistoryButton.tsx`) restores the definition or play
state before the newest change, one entry per press, back through the last 50 of both. The
undo history panel (`routes/CharacterLayout/UndoHistory/UndoHistory.tsx`) lists them and
undoes back to any one in a single write, after a confirmation, reversing every newer entry
of either kind. Saves to the same fields within 30 seconds merge into one entry, except a
level-up or a Level History change, which is always its own entry. A play-state change never
merges: each Damage, mark or rest is its own entry, and so is a combined write. Undoing to an
entry restores each kind changed by it or any later entry. It does not reach:

| Not reached | Reversed instead by |
|---|---|
| Creating, duplicating or importing a character | Deleting it; none of the three writes an undo entry |
| Pages | Their own undo, `components/PagesUndoButton.tsx`, held in the session and lost on reload |
| The portrait | Restore previous portrait in Settings, which holds one displaced image until the next upload or removal |
| A deleted character | A snapshot in `data/backups/`, by hand, as `docs/reviving.md` says |
| Homebrew rows | The editor's Undo for a save, and the delete toast or Recently deleted for a delete, until the API restarts: see Homebrew below |
| Browser settings: theme, accent, sources, the rail | A direct edit |
| An undo itself | Making the edit again by hand. Deliberate: #967 leaves redo out |
| A change older than the 50 newest | A direct edit, where one exists. The bound is deliberate: `undo_log` is a session affordance |

Undo back to an entry takes every newer entry with it; undoing one older entry alone, keeping the
newer ones, would need a merge of whole-definition snapshots, and nothing offers it.

## Creation

`routes/CreationFlow/CreationFlow.tsx` writes the whole definition in one `POST`, through
`hooks/useCreateCharacter.ts`. Until then the draft lives in `localStorage`
(`components/FormShell/formDraft.ts`), and leaving the form discards it by design.

| Decision | Changed on the sheet by | Reversed by |
|---|---|---|
| Name | `components/blocks/IdentitySection/IdentitySection.tsx` | Undo, a direct edit |
| Edition | Nothing | Cannot be, deliberately: the edition decides every catalog row the character names, so a switch would leave most of its picks outside the new rules. Build the character again under the other rules |
| Race and subrace | `components/blocks/IdentitySection/RaceCard.tsx` | Undo, a direct edit |
| Size, damage resistance a race offers | `components/blocks/IdentitySection/RaceCard.tsx` | Undo, a direct edit |
| Race and background ability increases | `components/blocks/IdentitySection/RaceCard.tsx`, `components/blocks/IdentitySection/BackgroundCard.tsx`, through `components/blocks/IdentitySection/OriginIncreases.tsx`, which names increases that do not match the row | Undo, a direct edit |
| A race or background spell block choice | The same cards, through `components/blocks/IdentitySection/OriginSpellBlocks.tsx`, which names a choice kept from another row | Undo, a direct edit |
| Background | `components/blocks/IdentitySection/BackgroundCard.tsx` | Undo, a direct edit |
| Deity | `components/blocks/IdentitySection/DeityCard.tsx` | Undo, a direct edit, clearing it |
| Alignment | `components/blocks/IdentitySection/AlignmentCard.tsx` | Undo, a direct edit |
| Base ability scores | `components/blocks/AbilitiesSection/AbilityScores.tsx` | Undo, a direct edit |
| Starting class | Level 1's Edit dialog in Level History, `components/blocks/LevelSection/LevelEditDialog.tsx` | Undo, changing it again |
| Level 1's choices | Each list's own control below, or level 1's Edit dialog in Level History | Undo, a direct edit, reopening again |
| Levels past 1 at creation | Level History, as for a level-up | As for a level-up |
| Skills, tools, languages | `components/blocks/AbilitiesSection/CatalogSkills.tsx`, `IdentitySection/ProficienciesCard.tsx`, `IdentitySection/LanguagesCard.tsx` | Undo, a direct edit |
| Spells | `components/blocks/SpellsSection/SpellList/SpellList.tsx` | Undo, a direct edit |
| Starting equipment and gold | The inventory rows below | Undo, a direct edit |
| A homebrew class written inline | `hooks/useEnsureHomebrewClass.ts`, from `routes/CreationFlow/ClassField.tsx` | Changing the starting class away from it, then deleting it under Homebrew once no character holds it |

## Level-up

| Decision | Written in | Reversed by |
|---|---|---|
| Taking a level | `components/blocks/LevelSection/LevelUpDialog.tsx` | Removing it, with every level after it, from its Edit dialog in Level History (`LevelSection/LevelRemoval.tsx`), or Undo, one level-up per press |
| A past level's hit point gain and choices | `components/blocks/LevelSection/LevelEditDialog.tsx`, the level's Edit dialog | Undo, editing it again |
| A past level's class, past the first | The same dialog. The gain starts over on the new class's die; a class the character did not hold lands its multiclass gains and asks its picks, and a class left at its only level takes them back | Undo, changing it again |
| An improvement or Epic Boon | `components/blocks/LevelSection/Improvements.tsx` | Undo, a direct edit |
| Experience and leveling mode | `LevelSection/ExperienceTracker.tsx`, `LevelSection/LevelingField.tsx` | Undo, a direct edit |

## The sheet

| Decision | Written in | Reversed by |
|---|---|---|
| A derived field's override | `routes/CharacterPage/CharacterPage.tsx`, through `hooks/useSaveOverride.ts` | Undo, clearing the override |
| Adding a homebrew skill to the character | `components/blocks/AbilitiesSection/AddHomebrewSkill.tsx` | Undo, removing it from its row |
| Removing a homebrew skill from the character | `components/blocks/AbilitiesSection/CatalogSkills.tsx`, `RemoveSkill.tsx` | Undo, which restores its level, overrides and flat number; the add above gives it back at no proficiency |
| A flat skill's number | The flat field in the skill's detail, `CatalogSkills.tsx` | Undo, a direct edit |
| Added resistances and immunities | `components/blocks/AbilitiesSection/Defenses/Defenses.tsx` | Undo, removing it |
| Weapon masteries | `components/blocks/AbilitiesSection/Attacks/WeaponMasteryChoice.tsx` | Undo, a direct edit |
| Feats and optional features | `components/blocks/FeaturesSection/FeatPicks.tsx`, `OptionalFeaturePicks.tsx` | Undo, a direct edit |
| A feature's choice | `components/blocks/FeaturesSection/FeatureChoiceField.tsx` | Undo, a direct edit |
| Appearance, backstory, notes | `IdentitySection/IdentitySection.tsx`, `components/blocks/BackstorySection.tsx`, `components/blocks/NotesSection.tsx` | Undo, a direct edit |
| An "Off the rules" note | `lib/departures.ts`, beside the pick that departs | Undo, or the remove button beside the note in the Off the rules card |
| A row added from search | `hooks/useAddToCharacter.ts` | Undo, removing it from its list |
| A page's layout and blocks | `routes/CharacterLayout/ManagePages/ManagePages.tsx`, `routes/CharacterPage/PageEditor.tsx` | Page undo, a direct edit |
| Restoring the default pages | `hooks/useRestoreDefaultPages.ts` | Page undo |

## Inventory

| Decision | Written in | Reversed by |
|---|---|---|
| Adding, removing, quantity, placing in a container, Use on a consumable (an undo entry of its own) | `components/blocks/InventorySection/ItemList/ItemList.tsx`, `lib/editInventoryEntry.ts` | Undo, a direct edit |
| Equipped, attuned, grip | `ItemList/ResolvedItemRow/EquipToggle.tsx`, `AttuneToggle.tsx`, `GripToggle.tsx` | Undo, toggling back |
| Coins | `components/blocks/InventorySection/CoinField.tsx` | Undo, a direct edit |
| An item's ability, proficiency or language pick | `ItemList/ItemPicks.tsx`, beside the entry | Undo, a direct edit |

## Homebrew

| Decision | Written in | Reversed by |
|---|---|---|
| Creating a row | `components/HomebrewEditor/HomebrewEditor.tsx`, through `hooks/useHomebrew.ts` | Deleting it |
| Saving an edit | That editor, opened from Homebrew or from a sheet through `components/EditHomebrewButton.tsx` | The editor's Undo, which reverts the row to the version its latest save replaced, one save deep. For a class that is the row, its features and its resource tables together: the form's three writes are one save, and a features-only or resources-only save reverts too. A held class changing under its characters is #900 |
| Deleting a row | `routes/Homebrew/DeleteHomebrewDialog.tsx` | The toast's Undo, or Restore under Recently deleted in Homebrew. A held row refuses the delete |

`routes/homebrew-history.ts` in `packages/api` holds each row's prior version and each deleted
row (a class with its features and resource tables) in the API's memory: a reload keeps
them, a restart loses them, and `homebrew.db` never holds them.
A revert goes through the kind's own PUT, so its refusals apply, and a restore reinserts under
the old id and refuses a name another row now holds.

## Settings

| Decision | Written in | Reversed by |
|---|---|---|
| House rules | `routes/CharacterSettings/HouseRulesCard.tsx` | Undo, toggling back |
| Uploading or removing the portrait | `routes/CharacterLayout/PortraitUpload.tsx`, `routes/CharacterSettings/PortraitCard.tsx` | Restore previous portrait in Settings, one image deep |
| Duplicating a character | `routes/CharacterSettings/CharacterSettings.tsx` | Deleting the copy |
| Importing a character | `components/CharacterActions.tsx` | Deleting it |
| Deleting a character | `routes/CharacterSettings/DeleteCharacterDialog.tsx` | A snapshot in `data/backups/`, by hand: `docs/reviving.md` |
| Theme and accent | `theme.ts`, `accent.ts`, from `routes/DisplaySettings.tsx` | A direct edit |
| The rail collapsed or open | `routes/Rail.tsx` | Toggling it |
| A character's sources turned off | `routes/CharacterSettings/SourcesCard.tsx` | Undo, toggling back |
| Sources turned off | `lib/disabledSources.ts`, from `routes/SourcesSettings/SourcesSettings.tsx` | A direct edit |

## Play state

`PUT /characters/{id}/state` (`packages/api/src/routes/characters.ts`) writes
`character_state` whole. A rest, Damage, Heal, the death saves, the spell slots and the class resources call it, through
`hooks/useReplaceCharacterState.ts`, and an import sets it. Each call that changes something
is one undo entry, which restores every field it changed and leaves the definition alone.

| Decision | Reversed by |
|---|---|
| Hit points, and the death saves they move | Undo, or Damage and Heal on the Hit Points card, `components/blocks/AbilitiesSection/Vitals/HitPointChange.tsx`. Heal restores current hit points that Damage took, but not the temporary hit points it spent, and healing from 0 clears both death-save counts rather than restoring them. Damage that kills asks first, because clearing a death save failure brings the character back still at 0 hit points |
| A reduction to the hit point maximum | Undo, or the reduction field and Lasts past a long rest in the maximum's breakdown on the Hit Points card, `components/blocks/AbilitiesSection/Vitals/HitPointMaximum.tsx`. A reduction lowers current hit points above the maximum it leaves, and clearing it restores none. A long rest clears it unless it was marked to last past one; a level-up keeps it |
| Temporary hit points | Undo, or the temporary field in the maximum's breakdown on the Hit Points card, `components/blocks/AbilitiesSection/Vitals/HitPointMaximum.tsx`, which sets the number typed |
| Death save marks, and death | Undo, or the marks and Roll on the Death Saves card, `components/blocks/AbilitiesSection/Vitals/DeathSaves.tsx`. Each mark is set or cleared by hand at any hit points, so a save recorded wrongly, or the second failure a critical hit at 0 costs, is marked there, and clearing a failure returns a dead character to dying |
| Spell and pact slots | Undo, or the pips on the Spell Slots card, `components/blocks/SpellsSection/SpellSlots/SpellSlots.tsx`. A pip leaves that many slots expended, so an empty pip spends every slot up to it and the last expended pip restores its slot |
| Class resources | Undo, or Spend, Restore and Reset on the Class Resources card, `components/blocks/FeaturesSection/ClassResources/ClassResources.tsx`. Spend and Restore move one pool's spent count by one, and Reset clears it. Start rage spends a Rages use and marks the character raging in one write, which Undo reverses together; End rage clears the mark and restores no use. A rest ends the rage, and so does damage to 0 hit points, in the write that takes it, so one Undo restores both |
| Conditions and exhaustion | Undo, or the add and remove controls and the exhaustion stepper on the Status Effects card, `components/blocks/AbilitiesSection/Vitals/StatusEffects.tsx`. Add offers the edition's catalog conditions not already held, or typed text no catalog condition, held condition or Exhaustion matches as a custom condition (`customConditions` in the play state), Remove drops every reference under that name, and the stepper moves the level by one from 0 to 6. At 0 hit points the card shows Unconscious from 0 hit points while dying or stable, with no remove control, so only healing above 0 or Undo of the damage clears it |
| Hit dice, and a rest | Undo, which restores every field the rest changed. Hit points also take Damage and Heal, slots the Spell Slots card, class resources the Class Resources card, and conditions and exhaustion the Status Effects card |
| Inspiration | Undo, or the bolt button in the character header, `routes/CharacterLayout/InspirationButton.tsx`, which toggles it |
| Concentration | Undo, a long rest, which ends it, and the Status Effects card's concentration controls, `components/blocks/AbilitiesSection/Vitals/ConcentrationField.tsx`. Concentrate sets any spell that needs concentration at its own level or higher, replacing the one held, and End concentration ends it. Damage taken while concentrating shows the Constitution save on the Hit Points card, `HitPointChange.tsx`, whose End concentration ends it in one write. Damage to 0 hit points, or adding Incapacitated, Paralyzed, Petrified, Stunned or Unconscious, ends it in the write that makes the change, so one Undo restores both |

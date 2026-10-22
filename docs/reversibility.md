# What can be reversed

Every decision the app stores, where it is written, and the way back from it. Paths are under
`packages/web/src/` unless they name a package. Each sheet edit reaches the API through
`hooks/useUpdateCharacterDefinition.ts`, and `updateCharacterDefinition`
(`packages/api/src/db/queries/characters.ts`) records the definition it replaced in `undo_log`.

## What Undo reaches

Control+Z (`routes/CharacterLayout/UndoHistoryButton.tsx`) restores the definition before the
newest change, one entry per press, back through the last 50. The undo history panel
(`routes/CharacterLayout/UndoHistory/UndoHistory.tsx`) lists them and undoes back to any one
in a single write, after a confirmation. Saves to the same fields within 30
seconds merge into one entry, except a level-up or a Level History change, which is always its own entry. It does not reach:

| Not reached | Reversed instead by |
|---|---|
| Creating, duplicating or importing a character | Deleting it; none of the three writes an undo entry |
| Play state (`character_state`) | A direct edit, once the controls in the play state rows below exist |
| Pages | Their own undo, `components/PagesUndoButton.tsx`, held in the session and lost on reload |
| The portrait | Nothing: #985 |
| A deleted character | A snapshot in `data/backups/`, by hand, as `docs/reviving.md` says |
| Homebrew rows | Nothing: #987 |
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
| Edition | Nothing | Cannot be: #983 |
| Race and subrace | `components/blocks/IdentitySection/RaceCard.tsx` | Undo, a direct edit |
| Size, damage resistance a race offers | Nothing | Cannot be: #983 |
| Race and background ability increases | Nothing | Cannot be: #983 |
| A race or background spell block choice | Nothing | Cannot be: #983 |
| Background | `components/blocks/IdentitySection/BackgroundCard.tsx` | Undo, a direct edit |
| Deity | Nothing | Cannot be: #983 |
| Alignment | `components/blocks/IdentitySection/AlignmentCard.tsx` | Undo, a direct edit |
| Base ability scores | `components/blocks/AbilitiesSection/AbilityScores.tsx` | Undo, a direct edit |
| Starting class | Nothing | Cannot be: #982 |
| Level 1's choices | Each list's own control below; Level History cannot reopen level 1 | Undo, a direct edit; reopening: #982 |
| Levels past 1 at creation | Level History, as for a level-up | As for a level-up |
| Skills, tools, languages | `components/blocks/AbilitiesSection/CatalogSkills.tsx`, `IdentitySection/ProficienciesCard.tsx`, `IdentitySection/LanguagesCard.tsx` | Undo, a direct edit |
| Spells | `components/blocks/SpellsSection/SpellList/SpellList.tsx` | Undo, a direct edit |
| Starting equipment and gold | The inventory rows below | Undo, a direct edit |
| A homebrew class written inline | `hooks/useEnsureHomebrewClass.ts`, from `routes/CreationFlow/ClassField.tsx` | Deleting it under Homebrew once no character holds it, which for the character it was made for means deleting that character: #982 |

## Level-up

| Decision | Written in | Reversed by |
|---|---|---|
| Taking a level | `components/blocks/LevelSection/LevelUp/LevelUpDialog.tsx` | Removing the newest level (`LevelSection/LevelRemoval.tsx`), or Undo, one level-up per press |
| A level's hit point gain | `components/blocks/LevelSection/LevelGainEdit.tsx` | Undo, a direct edit |
| A past level's choices | `components/blocks/LevelSection/LevelUp/LevelChoicesDialog.tsx` | Undo, reopening again; prerequisites: #980 |
| An improvement or Epic Boon | `components/blocks/LevelSection/Improvements.tsx` | Undo, a direct edit |
| Experience and leveling mode | `LevelSection/ExperienceTracker.tsx`, `LevelSection/LevelingField.tsx` | Undo, a direct edit |

## The sheet

| Decision | Written in | Reversed by |
|---|---|---|
| A derived field's override | `routes/CharacterPage/CharacterPage.tsx`, through `hooks/useSaveOverride.ts` | Undo, clearing the override |
| A custom skill | `components/blocks/AbilitiesSection/CustomSkills.tsx`, `RemoveCustomSkill.tsx` | Undo, a direct edit, removing it |
| Added resistances and immunities | `components/blocks/AbilitiesSection/Defenses/Defenses.tsx` | Undo, removing it |
| Weapon masteries | `components/blocks/AbilitiesSection/Attacks/WeaponMasteryChoice.tsx` | Undo, a direct edit |
| Feats and optional features | `components/blocks/FeaturesSection/FeatPicks.tsx`, `OptionalFeaturePicks.tsx` | Undo, a direct edit |
| A feature's choice | `components/blocks/FeaturesSection/FeatureChoiceField.tsx` | Undo, a direct edit |
| Appearance, backstory, notes | `IdentitySection/IdentitySection.tsx`, `components/blocks/BackstorySection.tsx`, `components/blocks/NotesSection.tsx` | Undo, a direct edit |
| An "Off the rules" note | `lib/departures.ts`, beside the pick that departs | Undo of the write that added it; removing one: #986 |
| A row added from search | `hooks/useAddToCharacter.ts` | Undo, removing it from its list |
| A page's layout and blocks | `routes/CharacterLayout/ManagePages/ManagePages.tsx`, `routes/CharacterPage/PageEditor.tsx` | Page undo, a direct edit |
| Restoring the default pages | `hooks/useRestoreDefaultPages.ts` | Page undo |

## Inventory

| Decision | Written in | Reversed by |
|---|---|---|
| Adding, removing, quantity, placing in a container | `components/blocks/InventorySection/ItemList/ItemList.tsx`, `editInventoryEntry.ts` | Undo, a direct edit |
| Equipped, attuned, grip | `ItemList/ResolvedItemRow/EquipToggle.tsx`, `AttuneToggle.tsx`, `GripToggle.tsx` | Undo, toggling back |
| Coins | `components/blocks/InventorySection/CoinField.tsx` | Undo, a direct edit |
| An item's ability, proficiency or language pick | Nothing; only an imported file sets one | Cannot be made or changed: #984 |

## Homebrew

| Decision | Written in | Reversed by |
|---|---|---|
| Creating a row | `routes/HomebrewSettings/HomebrewEditor.tsx`, through `hooks/useHomebrew.ts` | Deleting it |
| Saving an edit | The same | Cannot be: #987. A held class changing under its characters is #900 |
| Deleting a row | `routes/HomebrewSettings/DeleteHomebrewDialog.tsx` | Cannot be: #987. A held row refuses the delete |

## Settings

| Decision | Written in | Reversed by |
|---|---|---|
| House rules | `routes/CharacterSettings/HouseRulesCard.tsx` | Undo, toggling back |
| Uploading or removing the portrait | `routes/CharacterLayout/PortraitUpload.tsx`, `routes/CharacterSettings/PortraitCard.tsx` | Cannot be: #985 |
| Duplicating a character | `routes/CharacterSettings/CharacterSettings.tsx` | Deleting the copy |
| Importing a character | `components/CharacterActions.tsx` | Deleting it |
| Deleting a character | `routes/CharacterSettings/DeleteCharacterDialog.tsx` | A snapshot in `data/backups/`, by hand: `docs/reviving.md` |
| Theme and accent | `theme.ts`, `accent.ts`, from `routes/DisplaySettings.tsx` | A direct edit |
| The rail collapsed or open | `routes/Rail.tsx` | Toggling it |
| Sources turned off | `lib/disabledSources.ts`, from `routes/SourcesSettings/SourcesSettings.tsx` | A direct edit |

## Play state

`PUT /characters/{id}/state` (`packages/api/src/routes/characters.ts`) writes
`character_state` whole, and no control calls it yet; only an import sets it. Undo never reaches
it, since its log holds definitions alone. Each control below is the way back from its own
change.

| Decision | Control |
|---|---|
| Hit points, temporary hit points, death saves | Not built: #277, #274 |
| Spell and pact slots | Not built: #278 |
| Class resources | Not built: #279 |
| Conditions and exhaustion | Not built: #280 |
| Hit dice, and a rest | Not built: #281, #275 |
| Concentration, inspiration | Not stored: #123, #396 |

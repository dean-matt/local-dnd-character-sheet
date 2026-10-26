# UI mockup

A character sheet mockup, built while exploring the `packages/web` UI before writing any
of it. It runs entirely on static, hand-authored sample data — no `content.db`, no API —
so it is reference for layout and interaction, not a prototype of the real app.

`docs/mockup/components/` breaks the mockup into one artboard per widget, panel, or nav
element, each running its own sample data and state instead of a shared "current
character" — refining one piece no longer means reloading a single giant page.

Live, editable version: <https://claude.ai/artifact/LCpPbSnvJ7J8hesrvYJhpM>

They are Design Components, a claude.ai artifact format: plain HTML with inline styles
and a small `<script type="text/x-dc">` block per file driving the interactive state.
They do not run standalone in a browser — open the live link above to interact with
them, or read the markup here for the shapes and interactions it settled on.

The app takes its icons from `lucide-react` rather than copying an artboard's `<svg>`
markup.

## What is here

`Layout.dc.html` is a labeled wireframe of the page structure — top bar, collapsible
sidebar, content region, plus an optional character-header row — shared by the
character sheet and the settings page alike; read it first to see how the pieces fit
together. It is a fixed 1440px with no stretch behavior, so it fixes the arrangement and
not how each piece grows; `packages/web/LAYOUT.md` says that. Every other file matches a
widget, panel, or nav element:

- Stats: the seven widgets (Abilities, Saves, Skills, Combat, HP, Attacks, Status).
  Short Rest and Long Rest are the modals the Character Header's Rest menu opens;
  Long Rest restores half the Hit Dice under 2014 rules and all of them under 2024,
  switched by the artboard's Edition tweak.
- Inventory: Weapons, Armor, Gear. A price is a gold chip with a coin icon,
  read aloud as its cost. A versatile weapon's row has a 1h/2h grip toggle beside its
  Equip button, a gray pill track with the chosen grip on an accent-red thumb; the
  toggle picks the damage die the chip and formula show. 2h is unavailable while that
  weapon and a shield are both equipped, and hovering or focusing it opens a popover
  saying why. The artboard's `shieldEquipped` tweak switches the shield.
  Equip is a fixed 18px icon toggle with a 24px hit area, named for its item
  ("Equipped, Spear") with `aria-pressed` carrying the state. Stowed is a gray backpack
  on a white square, the same for every item type; equipped is the item type's icon in
  white on the accent — a sword for a weapon, a shirt for armor, a shield for a
  shield, a hand for other gear. Under the house rule that requires proficiency, an item
  the character is not proficient with shows a grayed backpack, named "Equip Spear,
  unavailable", whose popover names the missing proficiency. The Weapons and Armor
  artboards have no house-rule switch and draw that grayed backpack as the rule on, under
  the ordinary "Equipped, Spear" name. The
  icons are inline Lucide outlines (ISC), as is every icon on a list row.
- Spells: Spell Slots, Known Spells.
- Features: Class Features, Race Features, Chosen Features — each its own widget,
  the same list-plus-search-and-filter shape as Inventory and Spells.
- Page chrome: Character Header, Rolls Panel. Character Header is one 52px
  line: a 32px avatar with its upload badge, the name, the character's edition as a
  `2014` or `2024` chip (the same chip as the app's character list tile), then the subtitle
  — total level, race and classes — after a `·`, with the save status, then Inspiration
  (its icon alone, the label in a tooltip), Rest and a Character settings gear as 32px
  buttons at the right. The save status reads "Saving…" while any write to the character is in
  flight and "Saved" for a moment after; a save that fails or an entry a field refuses
  raises a toast at the bottom right naming the field, with Retry for a failed save, and
  no card changes height. The header artboard's `save` tweak switches between them. The name takes the room it needs and
  the subtitle the rest, never under 160px, so some of it always shows. A long name or
  subtitle ends in an ellipsis and keeps its full text in a tooltip; the `longText`
  tweak shows both truncated. Rolls
  Panel is a right-docked, collapsible rail — the counterpart to the tab rail on the left —
  listing rolls newest first, each tagged with what it was rolled for (a weapon, a
  spell, an ability check…) and which character made it, with a Clear button and a
  Filter button (by character, by roll type) in the same shape as the other list
  widgets' filters. Character sheet only, not Settings. Forward design for #282, which
  only specified the list; the dock, the collapse, and Clear are this mockup's own call.
  The Filter button and the per-roll character tag widen past #282's own "out of scope"
  line ("Filtering or searching the log") and its single-character framing — #311 and #312
  are the new issues that settle those two.
- Overlays: Add Widget Picker.
- Add Widget Picker is a category sidebar (a tab list, same pattern as the tab rail)
  plus search narrowing a grid of preview cards (a category icon, name, and category)
  for the full catalog of addable widgets. Clicking a card always adds another copy —
  nothing caps a widget to one instance — and the card's "+ Add" label picks up a
  running count once one is on the tab. Used only by Custom Tab.
- Custom Tab is sized like the real "active section content" area from Layout.dc.html
  and shows the widget canvas a user-created tab gets: an Edit button gates
  drag-to-move and drag-a-corner-to-resize (each card previews as a title over a few
  skeleton content lines, not the real widget), and a ghost "Add Widget" button opens
  the picker. Built-in tabs (Stats, Inventory, Spells, Features, Identity, Level,
  Backstory, Notes) never get this — their widgets are fixed.
- Filters: WeaponsFilter, ArmorFilter, GearFilter, SpellListFilter, ClassFeaturesFilter,
  RaceFeaturesFilter, ChosenFeaturesFilter, RollsPanelFilter — each is mounted into its
  list widget from a Filter button in that widget's header, and sits next to that
  widget on the canvas. Forward design for #311, since none of these widgets' own
  issues had settled a filter yet.

## Covered

Ability scores, saves, and skills (with custom, non-ability-based
skills); a tab rail where any tab reorders, hides and renames, but only a user-created
tab deletes or has its widgets added, moved, or resized; inventory split into weapons, armor, and
gear, gated by proficiency to equip; spell slots as a per-level, clickable pip tracker;
short and long rest; temporary HP; status effects; a global
search across characters and a sample compendium, with an advanced search page, a
catalog detail modal, and a way to add a result to a character; light, dark, and system
theme; a user-customizable accent color; a settings page for homebrew content and sources; a way
to add or remove experience points in XP leveling mode; and a filter on Weapons, Armor,
Gear, Known Spells, Class Features, Race Features, and Chosen Features to narrow
what the widget shows.
Hovering a calculated value (an ability modifier, a save or skill bonus, AC, initiative,
max HP, an attack bonus) opens a popover with its formula; clicking a widget's item
(an ability, a skill, a weapon, a spell, a feature, and so on) opens a modal with that
item's fuller detail. Both are white with a bold label line over a muted body line; the
popover carries a `#dde1e6` border, and the modal drops it for a heavier shadow over a
dimmed page.

Simplifications specific to these widgets:
- AC is a flat editable stat, not derived from equipped armor — that computation belongs
  to the real Inventory implementation.
- Weapons and Armor use a narrower sample proficiency list than a full character would,
  so both the allowed and the proficiency-blocked equip states show up.

## Known gaps

- No mobile or narrow-width pass exists in this style yet — an earlier, since-removed
  version of this mockup had one; a phone-width layout still needs redoing here.
- On Custom Tab, dragging a widget's corner cycles it through four preset sizes
  (S/M/L/XL) rather than resizing to an arbitrary pixel size.

## Retiring an artboard

An artboard leads its widget's look and behavior until everything it shows has shipped,
editing included. The pull request that merges the last open issue in its row below
retires it: it deletes the file from `components/`, its entry from both `boards` and
`order` in `canvas.json`, its row here and every other mention of it, such as its bullet
under What is here, then publishes the deletion as [Changing a mockup](#changing-a-mockup)
says.
After that the app leads. A visual change to the widget is made in the app, and no mockup
issue is filed for it; a redesign may still draw a fresh artboard for that one change,
deleted by the pull request that builds it.

An issue filed against something an artboard draws joins that artboard's row. Shipped
says how much of the artboard the app builds today.

| Artboard | Retired by | Shipped |
|---|---|---|
| `Layout` | #282 | all but the Rolls Panel |
| `Abilities` | #227, #487 | the scores edit, the rest read-only |
| `Saves` | #227, #487 | read-only |
| `Skills` | #227, #399, #487 | the rings and custom skills edit, the rest read-only |
| `Combat` | #227, #228 | read-only |
| `HP` | #277, #281, #487 | read-only |
| `Attacks` | #398, #487 | read-only |
| `Status` | #280 | read-only |
| `ShortRestModal` | #281 | nothing |
| `LongRestModal` | #281 | nothing |
| `Weapons` | #311, #398, #400 | all but the filter and its own search |
| `WeaponsFilter` | #311 | nothing |
| `Armor` | #311, #400 | all but the filter and its own search |
| `ArmorFilter` | #311 | nothing |
| `Gear` | #311 | all but the filter and its own search |
| `GearFilter` | #311 | nothing |
| `SpellSlots` | #230, #278, #800 | read-only |
| `SpellList` | #230, #311 | all but the filter and the custom spell |
| `SpellListFilter` | #311 | nothing |
| `ClassFeatures` | #279, #311 | read-only |
| `ClassFeaturesFilter` | #311 | nothing |
| `RaceFeatures` | #279, #311 | read-only |
| `RaceFeaturesFilter` | #311 | nothing |
| `ChosenFeatures` | #231, #279, #311 | the optional-feature picks, the rest read-only |
| `ChosenFeaturesFilter` | #311 | nothing |
| `CharacterHeader` | #227, #241, #281, #391, #394, #395, #396, #452, #674 | the settings gear and the portrait upload, the rest read-only |
| `RollsPanel` | #282, #311, #312 | nothing |
| `RollsPanelFilter` | #311, #312 | nothing |
| `WidgetPicker` | #819 | nothing |
| `CustomTab` | #819 | nothing |

## Changing a mockup

The user reviews a mockup on the live canvas, never in the diff, so a pull request that
changes `docs/mockup/components/` waits on their approval there.

1. **Open the pull request as a draft, and publish from the session holding the
   conversation with the user once the review has converged.** A dispatched run reports
   each changed file instead of publishing.
2. **Read the canvas, then list its files**: an Artifact `read` of the live link, then a
   `list` with `scope: "files"`. The publish refuses an artifact this session has not
   read, and a path it has neither read nor listed.
3. **Publish every changed file in one call**: an Artifact `publish` with the live link as
   `url` and `files` mapping `project/<name>` to `docs/mockup/components/<name>`, or to
   `null` for a file the branch deletes. A changed `canvas.json` publishes the same way.
4. **Record it on the pull request.** Add `Canvas: <live link>, version <version>` to the
   body, with the version the publish returned, then `gh pr ready <pr>`. A later push
   that changes a mockup file publishes again and replaces the line, so the version the
   user approves is the head that merges.
5. **Merge only on the user's approval.** `.github/protected-paths` fences the directory,
   so the merge gate fails until the user approves the mockup on the canvas and the session
   holding the conversation merges on that sign-off, as the plugin's `signoff` skill describes.

No skill closes a pull request, so whoever closes one without merging puts the canvas back
in the same turn: publish `main`'s version of each file it published, writing
`git show origin/main:docs/mockup/components/<name>` to the scratchpad and mapping
`project/<name>` to that copy, and `null` for a file `main` does not have. Where another
open pull request with a `Canvas:` line also changes the file, publish that pull request's
head version instead, from `git show <its head>:docs/mockup/components/<name>`;
`gh pr list --state open --json number,body,files,headRefOid` lists all three.

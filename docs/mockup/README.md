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

## What is here

`Layout.dc.html` is a labeled wireframe of the page structure — top bar, collapsible
sidebar, content region, plus an optional character-header row — shared by the
character sheet and the settings page alike; read it first to see how the pieces fit
together. It is a fixed 1440px with no stretch behavior, so it fixes the arrangement and
not how each piece grows; `packages/web/LAYOUT.md` says that. Every other file matches a
widget, panel, or nav element:

- Stats: the eight widgets (Abilities, Saves, Skills, Combat, HP, Attacks, Status,
  Defenses). Short Rest and Long Rest are the modals the Character Header's Rest menu
  opens; Long Rest restores half the Hit Dice under 2014 rules and all of them under
  2024, switched by the artboard's Edition tweak.
- Inventory: Currency, Weapons, Armor, Gear. A price is a gold chip with a coin icon,
  read aloud as its cost. A versatile weapon's row has a 1h/2h grip toggle beside its
  Equip button, a gray pill track with the chosen grip on an accent-red thumb; the
  toggle picks the damage die the chip and formula show. 2h is unavailable while that
  weapon and a shield are both equipped, and hovering or focusing it opens a popover
  saying why. The artboard's `shieldEquipped` tweak switches the shield.
  Equip is a fixed 18px icon toggle with a 24px hit area, named for its item
  ("Equipped, Spear") with `aria-pressed` carrying the state. Stowed is a gray backpack
  on a white square, the same for every item type; equipped is the item type's icon in
  white on the accent — a sword for a weapon, a shirt for armor, a shield for a
  shield, a hand for other gear. An item the character is not proficient with shows a
  grayed backpack, `aria-disabled`, with a popover naming the missing proficiency. The
  icons are inline Lucide outlines (ISC), as is every icon on a list row. Weapons, Armor
  and List Item draw it.
- Spells: Spell Slots, Known Spells.
- Features: Class Features, Race Features, Chosen Features — each its own widget,
  the same list-plus-search-and-filter shape as Inventory and Spells.
- Backstory, Notes.
- Identity: Name, Race, Class, Background, Languages, Proficiencies — each its own
  widget. Level (level, leveling mode, experience) and Alignment are their own sidebar
  tabs, not part of Identity. Level Up is the modal a level-up button on Level opens —
  pick an existing class or multiclass into a new one, Hit Points by average, roll, or
  a typed-in value, an Ability Score Improvement or a feat at the levels that grant one,
  and new spells for a class that gains them, all gating Apply until every open choice
  the level actually offers is made.
- Page chrome: Sidebar (the tab rail), Top Bar Navigation (Character menu, Mechanics
  menu, search, and a Settings link), Character Header, Rolls Panel. The top bar marks
  the section you are in by its label alone — accent-colored and bold, with no fill or
  underline — and an open menu takes a gray fill instead. Character Header is one 52px
  line: a 32px avatar with its upload badge, the name, the character's edition as a
  `2014` or `2024` chip (the same chip as the Character List tile), then the subtitle
  after a `·`, with Inspiration (its icon alone, the label in a tooltip), Rest and the
  character menu as 32px buttons at the right. The name takes the room it needs and
  the subtitle the rest, never under 160px, so some of it always shows. A long name or
  subtitle ends in an ellipsis and keeps its full text in a tooltip; the `longText`
  tweak shows both truncated. Manage Tabs is the modal
  Sidebar's "Manage Tabs" button opens: every tab reorders (drag) and hides here, but
  only a tab a user added renames or deletes — delete asks Confirm Dialog first. Rolls
  Panel is a right-docked, collapsible rail — the counterpart to Sidebar on the left —
  listing rolls newest first, each tagged with what it was rolled for (a weapon, a
  spell, an ability check…) and which character made it, with a Clear button and a
  Filter button (by character, by roll type) in the same shape as the other list
  widgets' filters. Character sheet only, not Settings. Forward design for #282, which
  only specified the list; the dock, the collapse, and Clear are this mockup's own call.
  The Filter button and the per-roll character tag widen past #282's own "out of scope"
  line ("Filtering or searching the log") and its single-character framing the same way
  the character list's avatar widens past #206's — #311 and #312 are the new issues that
  settle those two, same as #310 settled the character list's own widening.
- Character List and Creation 1/5 through 5/5 are full pages, not modals over the sheet
  — sized to the same 1440px width as Layout and Top Bar Navigation, under the same top
  bar with Character marked active. Neither boxes its content in a panel: it sits on the
  page background, as the character sheet's does. Each creation step puts the five steps
  in a left rail shaped like Sidebar — done, current, and not-yet-reached, with Cancel
  at its foot — and its own two-column content beside it. Top Bar Navigation's Character
  menu is how both are reached: "See all characters →" opens the list, and "+ New
  Character" opens creation — a menu that jumps straight to one character is a different
  action from either.
- Character List is the entry point before any of the above — every character's name,
  level, edition, race and class summary (`High Elf Ranger`, or `Fighter 3 / Wizard 2`
  for a multiclass character), and an avatar (a colored initial circle when a character
  has none), a page header offering Import and New Character, forward design for #206.
  The avatar widens past #206's own "out of scope" line the same way creation's Class
  step widens past #235's — a deliberate call, not an oversight the issue's text missed.
  Race and class needed a real schema answer rather than just a mockup call: #310 adds
  the `race_summary` and `class_summary` columns #206 now reads, alongside `name`,
  `edition`, and `level`, so the list still never parses a character's `definition` blob
  per row.
  Creation 1/5 through 5/5 (Identity, Class, Ability Scores, Proficiencies &
  Equipment, Spells) are the wizard "+ New Character" opens: the step rail, Back/Next
  (Finish on the last step), and the acceptance criteria #234-#238 already settled — a
  race with subraces blocks progress until one is picked, a proficiency granted twice is
  flagged rather than silently dropped, point buy shows an overspend rather than
  refusing it, a non-caster skips the spells step. Nothing behind any of these six
  exists yet, and #224 (whether the flow validates as it goes or all at once) is still
  undecided — these are the step content and the interaction shape, not that answer.
  Creation 2/5 supports starting multiclassed — add more than one class, each with its
  own level and subclass — even though #235's own "out of scope" line names a second
  class as #240's job. Real tables commonly build a multiclass character in one pass
  when starting above level 1, which #235 doesn't rule out, so this widens that step
  rather than matching the letter of the issue. HP follows 5e's own multiclass rule:
  the character's very first level is always the first class's hit die at max, and
  every level after — in that class or a later one — rolls or averages against
  whichever class it belongs to.
  Every picker in these six pages searches a small in-file array, the same convention
  every other widget in this mockup uses to stand in for #226's real catalog-and-homebrew
  search; Top Bar Navigation's global search is the one place that already spans both
  characters and a sample compendium.
- Settings page: Settings Sidebar (same rail as Sidebar.dc.html, same size), Display
  Settings (theme — light/dark/system — and accent), Homebrew Weapons, Homebrew Armor,
  Homebrew Gear, Homebrew Spells (one artboard per category, each pasting the entry's
  5etools-shaped JSON and showing the same chips — damage die, AC, category, spell
  level/school — its real counterpart widget does), Sources — a per-source toggle for
  Mechanics search and catalog pickers, forward design for #313.
- Homebrew Races, Homebrew Classes, Homebrew Backgrounds, Homebrew Feats follow the same
  paste-and-parse shape as the four shipped Homebrew artboards above, but nothing behind
  them exists yet — `homebrew.db` only reaches items and spells today. They're forward
  design for #306, #307, #308, and #309, not a page a build currently renders.
- Overlays: Confirm Dialog, Add Widget Picker.
- Confirm Dialog is also a real component now, not just a demo: Manage Tabs drives it
  with `open`/`message`/`onConfirm`/`onCancel` props, and it falls back to its own
  always-open demo state when those are left unset.
- Add Widget Picker is a category sidebar (a tab list, same pattern as Sidebar.dc.html)
  plus search narrowing a grid of preview cards (a category icon, name, and category)
  for the full catalog of addable widgets. Clicking a card always adds another copy —
  nothing caps a widget to one instance — and the card's "+ Add" label picks up a
  running count once one is on the tab. Used only by Custom Tab.
- Custom Tab is sized like the real "active section content" area from Layout.dc.html
  and shows the widget canvas a user-created tab gets: an Edit button gates
  drag-to-move and drag-a-corner-to-resize (each card previews as a title over a few
  skeleton content lines, not the real widget), and a ghost "Add Widget" button opens
  the picker. Built-in tabs (Stats, Inventory, Spells, Features, Identity, Level,
  Alignment, Backstory, Notes) never get this — their widgets are fixed.
- Reference: Popover and Modal show the two interaction patterns below in isolation,
  always open, so they can be reviewed without hovering or clicking inside a live widget.
  List Item shows the row shape shared by Weapons, Armor, Gear, Known Spells, the
  Features widgets, and every Homebrew artboard — design it here first, then carry a
  change into each widget's rows. The name, its gray property chips and the gold price
  chip share the first line, with remove at the right; the description takes the
  second; the accent action chips (Attack, Damage, AC) take the third, with the row's
  controls (Equip, Prepared, Edit, a feature's use pips) at its right. Remove (an x)
  and Edit (a pencil) are gray icons with no border or fill in Equip's 18px box, so the
  three share one column. A row with neither has no third line.
- Filters: WeaponsFilter, ArmorFilter, GearFilter, SpellListFilter, ClassFeaturesFilter,
  RaceFeaturesFilter, ChosenFeaturesFilter, RollsPanelFilter — each is mounted into its
  list widget from a Filter button in that widget's header, and sits next to that
  widget on the canvas. Forward design for #311, since none of these widgets' own
  issues had settled a filter yet.

## Covered

Ability scores, saves, and skills (with custom, non-ability-based skills); a tab rail
where any tab reorders and hides, but only a user-created tab renames, deletes, or has
its widgets added, moved, or resized; inventory split into weapons, armor, and
gear, gated by proficiency to equip; spell slots as a per-level, clickable pip tracker;
short and long rest; temporary HP; status effects and resistances/immunities; a global
search across characters and a sample compendium; light, dark, and system theme; a
user-customizable accent color; a settings page for homebrew content and sources; a way
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
- Race and Background pick from a small fixed sample list, not the real catalog; Class
  is multi-select (chips, each with its own level) to cover multiclassing.
- Homebrew items and spells edit by replacing the whole pasted entry, per
  `docs/data-model.md`'s rule that homebrew rows are written once and never edited field
  by field — there's no per-field form.

## Known gaps

- No mobile or narrow-width pass exists in this style yet — an earlier, since-removed
  version of this mockup had one; a phone-width layout still needs redoing here.
- No keyboard navigation through the search dropdowns.
- Clicking a compendium search result adds it directly; there is no detail view first.
- On Custom Tab, dragging a widget's corner cycles it through four preset sizes
  (S/M/L/XL) rather than resizing to an arbitrary pixel size.

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
5. **Merge only on the user's approval.** `scripts/merge-gate.mjs` fences the directory,
   so the gate fails until the user approves the mockup on the canvas and the session
   holding the conversation merges on that sign-off, as `merge-pr` describes.

No skill closes a pull request, so whoever closes one without merging puts the canvas back
in the same turn: publish `main`'s version of each file it published, writing
`git show origin/main:docs/mockup/components/<name>` to the scratchpad and mapping
`project/<name>` to that copy, and `null` for a file `main` does not have. Where another
open pull request with a `Canvas:` line also changes the file, publish that pull request's
head version instead, from `git show <its head>:docs/mockup/components/<name>`;
`gh pr list --state open --json number,body,files,headRefOid` lists all three.

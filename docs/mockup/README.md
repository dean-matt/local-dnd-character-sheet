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
- Identity: Race, Class, Background, Languages, Proficiencies — each its own
  widget. Level (level, leveling mode, experience) is its own sidebar tab, not part of
  Identity. Level Up is the modal a level-up button on Level opens —
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
- Search: while Top Bar Navigation's search pill has focus or a query, a scrim dims
  everything else; clicking it or pressing Escape closes the results and returns focus to
  the pill. While the scrim is up, Tab skips the dimmed Character, Mechanics and Settings
  controls. Results group under Characters and Compendium, each with a type chip and each
  compendium row carrying the source chip List Item defines, and an "Advanced search" link at the foot opens Search,
  the `search` route. The app carries the pill's query there as `?q=<query>`; each
  artboard keeps its own state, so Search opens on its own sample query. Search draws the
  query field, the results, and a collapsible filter sidebar shaped like Sidebar, its
  controls the Filter artboards' checkboxes and level range. Type, Source, School, Rarity
  and Kind are each the same multi-select: a button naming what is chosen ("All types",
  "Spells, Items", "3 types") that opens a list of checkboxes, with a filter box at the top
  of any list longer than ten and a Clear link beside the filter's heading once something
  is chosen. The Spells and Items rows carry an icon saying they add filters. Collapsed,
  the sidebar shows a filter icon badged with how many filters are on, and its foot keeps
  the expand button. The query field, results and confirmation fill the main column
  beside the sidebar, with no maximum width. It filters by type, source and edition, and
  adds level and school once Spells is chosen and rarity and kind once Items is — a melee weapon, light armor or a wondrous
  item, each grouping upstream's item type codes. A row with no edition, which Tier B and C allow though
  no loader writes one today, would show under either edition. The API's `/search`
  takes every filter Search offers, but matches `q` against a Tier A row's name alone,
  so matching a row's text, as Search does for Flame Tongue on "fire", is forward design.
  The Mechanics menu is a hand-picked list in three columns, wide enough to need no
  scrolling, ending in "All types…", which opens Search unfiltered; the app shows an entry
  once search returns its type. Weapons and Armor open Search on items of those kinds. An
  item result, here and in the dropdown, keeps its Item chip and leads the line under its
  name with its kind, then its rarity: "Martial ranged weapon • Uncommon".
- Catalog Detail is a modal, not a page: a result in the dropdown or on Search, or a
  rules-text reference on a sheet, opens it over the page that holds the link, and the
  app drops its `catalog` route (#537). Its `host` tweak draws that page behind the
  scrim, and its `kind` tweak switches between a short spell, a long one, an item, a feat,
  a homebrew item, a monster, a legendary group, a deity and a language. It opens on the long spell, its body scrolled partway, so the header
  and footer show holding still while the rules text scrolls; its `scrolled` tweak starts
  the body at the top instead. It puts the type chip beside
  the name and, below the name, the source chip and the edition year chip the app's
  `EditionTag` draws; the rules text follows, or the empty rules-text state for the
  homebrew item. A monster's text is its stat block: size, type and alignment, the lines
  from Armor Class to Speed, the six abilities as a table, the lines from Saving Throws to
  Challenge, then a heading per group of traits and actions, each trait under a heading
  of its own. A line the monster lacks is left out. A monster with a legendary group ends
  on a link to it, which opens its lair actions and regional effects in its place. A
  deity or a language opens on a bold-labelled line per field, ahead of any prose: a
  deity's pantheon, alignment, domains, province and symbol, and a language's type,
  script, typical speakers and, on a 2024 row, origin. A field the row lacks is left out, and its fields stand in
  for the empty rules-text state where it has no prose. "Add to…" sits at the bottom right of a footer pinned to the modal's foot, and its picker opens
  above it. Focus moves into the modal when it
  opens and Tab stays inside it; the close button, the scrim and Escape close it from any
  entry and return focus to the link. A link inside the modal replaces its entry rather
  than opening a second modal. A back button at the page's top left, over the scrim, reads
  "Back to" the entry before and returns to it, or reads "Back" on the first and closes
  the modal. The artboard's `throughLink` tweak opens on an entry reached through a link.
- Add to…: every item, spell and feat result on Top Bar Navigation and Search carries
  "Add to…", and so does Catalog Detail. Opened from a sheet (the `openedFrom` tweak, always true
  of Catalog Detail's `sheet` host), it adds to that character; opened anywhere else, it
  asks which character first, and says there is none to add to when the list is empty
  (the `noCharacters` tweak). Top Bar Navigation opened from elsewhere sits over the
  Settings page instead of a sheet. A row the rules do not allow, such as Fireball for a
  ranger or Elemental Adept for a fighter who casts no spell, still lands, and the
  confirmation notes why it is unusual. Races, classes and
  subclasses carry no "Add to…", since creation and level-up own them.
- Character List and Creation 2/5 through 5/5 are full pages, not modals over the sheet
  — sized to the same 1440px width as Layout and Top Bar Navigation, under the same top
  bar with Character marked active. Neither boxes its content in a panel: it sits on the
  page background, as the character sheet's does. Each creation step puts the five steps
  in a left rail shaped like Sidebar — done, current, and not-yet-reached, collapsing to
  the step numbers by the same toggle at its foot — and its own two-column content beside
  it, with Cancel on the left of the bar under the content and Back beside Next on the right. The app's home page and Top Bar
  Navigation's Character menu are how both are reached: "See all characters →" opens the list, and
  "+ New Character" opens creation — a menu that jumps straight to one character is a
  different action from either.
- Character List is the full list at the `characters` route — every character's name,
  level, edition, race and class summary (`High Elf Ranger`, or `Fighter 3 / Wizard 2`
  for a multiclass character), and an avatar (a colored initial circle when a character
  has none), a page header offering Import and New Character, forward design for #206.
  The avatar widens past #206's own "out of scope" line the same way creation's Class
  step widens past #235's — a deliberate call, not an oversight the issue's text missed.
  Race and class needed a real schema answer rather than just a mockup call: #310 adds
  the `race_summary` and `class_summary` columns #206 now reads, alongside `name`,
  `edition`, and `level`, so the list still never parses a character's `definition` blob
  per row.
  Creation 2/5 through 5/5 (Class, Ability Scores, Proficiencies & Equipment, Spells)
  are the wizard steps after Identity, which the app builds and leads, so each rail draws
  step 1 without a link and "+ New Character" opens Class here. They carry the
  step rail, Back/Next (Finish on the last step), and the acceptance criteria #235-#238
  already settled — a class skill the background already grants shows checked and
  disabled rather than pickable twice, point buy shows an overspend rather than refusing
  it, a non-caster skips the spells step. The app builds the rail, Back, Next and Finish.
  Its Next validates nothing, since the schema is checked only at Finish, and every step
  in its rail is a link rather than locked until reached.
  Creation 2/5 supports starting multiclassed — add more than one class, each with its
  own level and subclass — even though #235's own "out of scope" line names a second
  class as #240's job. Real tables commonly build a multiclass character in one pass
  when starting above level 1, which #235 doesn't rule out, so this widens that step
  rather than matching the letter of the issue. HP follows 5e's own multiclass rule:
  the character's very first level is always the first class's hit die at max, and
  every level after — in that class or a later one — rolls or averages against
  whichever class it belongs to.
  Every picker in these five pages searches a small in-file array, the same convention
  every other widget in this mockup uses to stand in for #226's real catalog-and-homebrew
  search; Top Bar Navigation's global search is the one place that already spans both
  characters and a sample compendium.
- Settings page: Settings Sidebar (same rail as Sidebar.dc.html, same size), Homebrew
  Weapons, Homebrew Armor, Homebrew Gear, Homebrew Spells (one artboard per category, each pasting the entry's
  5etools-shaped JSON and showing the same chips — damage die, AC, category, spell
  level/school — its real counterpart widget does).
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
- Reference: List Item shows the row shape shared by Weapons, Armor, Gear, Known
  Spells, the Features widgets, and every Homebrew artboard — design it here first, then
  carry a change into each widget's rows. The name, the source chip, its gray property chips
  and the gold price chip share the first line, with remove at the right; the description takes the
  second; the accent action chips (Attack, Damage, AC) take the third, with the row's
  controls (Equip, Prepared, Edit, a feature's use pips) at its right. Remove (an x)
  and Edit (a pencil) are gray icons with no border or fill in Equip's 18px box, so the
  three share one column. A row with neither has no third line. The source chip is one
  gray-filled chip holding a source's abbreviation, or Homebrew for a homebrew row, read
  aloud and shown on hover as the source's title. Wherever a row carries an edition, as a
  search result and Catalog Detail do, the year chip sits beside it; a sheet row shows the
  source alone, since the source already tells a 2014 book from a 2024 one. The Homebrew
  artboards leave it out: every row there is homebrew. List Item's
  `homebrew` tweak turns its chip to Homebrew, and `showYear` hides the year.
- Filters: WeaponsFilter, ArmorFilter, GearFilter, SpellListFilter, ClassFeaturesFilter,
  RaceFeaturesFilter, ChosenFeaturesFilter, RollsPanelFilter — each is mounted into its
  list widget from a Filter button in that widget's header, and sits next to that
  widget on the canvas. Forward design for #311, since none of these widgets' own
  issues had settled a filter yet.

## Covered

Ability scores, saves, and skills (with custom, non-ability-based
skills); a tab rail where any tab reorders and hides, but only a user-created tab
renames, deletes, or has its widgets added, moved, or resized; inventory split into weapons, armor, and
gear, gated by proficiency to equip; spell slots as a per-level, clickable pip tracker;
short and long rest; temporary HP; status effects and resistances/immunities; a global
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
- Race and Background pick from a small fixed sample list, not the real catalog; Class
  is multi-select (chips, each with its own level) to cover multiclassing.
- Homebrew items and spells edit by replacing the whole pasted entry, per
  `docs/data-model.md`'s rule that homebrew rows are written once and never edited field
  by field — there's no per-field form.

## Known gaps

- No mobile or narrow-width pass exists in this style yet — an earlier, since-removed
  version of this mockup had one; a phone-width layout still needs redoing here.
- The search dropdowns take Tab and Escape, but not the arrow keys.
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
| `Skills` | #227, #399, #487 | read-only |
| `Combat` | #227, #228 | read-only |
| `HP` | #277, #281, #487 | read-only |
| `Attacks` | #398, #487 | read-only |
| `Status` | #280 | read-only |
| `Defenses` | #387, #488 | read-only |
| `ShortRestModal` | #281 | nothing |
| `LongRestModal` | #281 | nothing |
| `Currency` | #229 | read-only |
| `Weapons` | #229, #311, #398, #400 | read-only, and the grip toggle |
| `WeaponsFilter` | #311 | nothing |
| `Armor` | #229, #311, #400 | read-only |
| `ArmorFilter` | #311 | nothing |
| `Gear` | #229, #311 | read-only |
| `GearFilter` | #311 | nothing |
| `SpellSlots` | #230, #278 | read-only |
| `SpellList` | #230, #311 | read-only |
| `SpellListFilter` | #311 | nothing |
| `ClassFeatures` | #279, #311 | read-only |
| `ClassFeaturesFilter` | #311 | nothing |
| `RaceFeatures` | #279, #311 | read-only |
| `RaceFeaturesFilter` | #311 | nothing |
| `ChosenFeatures` | #231, #279, #311 | read-only |
| `ChosenFeaturesFilter` | #311 | nothing |
| `Backstory` | #392 | nothing |
| `Notes` | #401 | read-only |
| `Race` | #488 | read-only |
| `Class` | #235, #240 | read-only |
| `Background` | #488 | read-only |
| `Level` | #239, #393 | read-only |
| `LevelUpModal` | #239, #240 | nothing |
| `Languages` | #488 | read-only |
| `Proficiencies` | #400, #488 | read-only |
| `Sidebar` | #242, #470, #486 | read-only |
| `ManageTabs` | #242 | reorder and hide |
| `TopBar` | #386, #521, #522 | all but "Add to…" |
| `Search` | #521, #522 | all but "Add to…" |
| `CatalogDetail` | #522, #537, #555 | all but "Add to…" |
| `CharacterHeader` | #227, #241, #281, #391, #394, #396, #452 | read-only |
| `RollsPanel` | #282, #311, #312 | nothing |
| `RollsPanelFilter` | #311, #312 | nothing |
| `SettingsSidebar` | #243, #486, #489 | Display and Sources |
| `HomebrewWeapons` | #243 | nothing |
| `HomebrewArmor` | #243 | nothing |
| `HomebrewGear` | #243 | nothing |
| `HomebrewSpells` | #243 | nothing |
| `HomebrewRaces` | #489 | nothing |
| `HomebrewClasses` | #489 | nothing |
| `HomebrewBackgrounds` | #489 | nothing |
| `HomebrewFeats` | #489 | nothing |
| `WidgetPicker` | #242 | nothing |
| `CustomTab` | #242 | nothing |
| `CharacterList` | #233, #391, #395 | read-only |
| `CreationClass` | #233, #235, #240 | the step rail, Back, Next and Finish |
| `CreationAbilityScores` | #233, #236 | the step rail, Back, Next and Finish |
| `CreationProficiencies` | #233, #237 | the step rail, Back, Next and Finish |
| `CreationSpells` | #233, #238 | the step rail, Back, Next and Finish |
| `ConfirmDialog` | #241, #242 | nothing |
| `ListItem` | #229, #230, #231, #243, #279, #398 | read-only |

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
   holding the conversation merges on that sign-off, as `user-signoff` describes.

No skill closes a pull request, so whoever closes one without merging puts the canvas back
in the same turn: publish `main`'s version of each file it published, writing
`git show origin/main:docs/mockup/components/<name>` to the scratchpad and mapping
`project/<name>` to that copy, and `null` for a file `main` does not have. Where another
open pull request with a `Canvas:` line also changes the file, publish that pull request's
head version instead, from `git show <its head>:docs/mockup/components/<name>`;
`gh pr list --state open --json number,body,files,headRefOid` lists all three.

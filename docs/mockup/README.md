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
together. Every other file matches a widget, panel, or nav element:

- Overview: the eight widgets (Abilities, Saves, Skills, Combat, HP, Attacks, Status,
  Defenses).
- Inventory: Currency, Weapons, Armor, Gear.
- Spells: Spell Slots, Known Spells.
- Features: Class Features, Race Features, Chosen Features — each its own widget,
  the same list-plus-search-and-filter shape as Inventory and Spells.
- Backstory, Notes.
- Identity: Name, Race, Class, Background, Languages, Proficiencies — each its own
  widget. Level (level, leveling mode, experience) and Alignment are their own sidebar
  tabs, not part of Identity.
- Page chrome: Sidebar (the tab rail), Top Bar Navigation (Character menu, Mechanics
  menu, search, Settings), Character Header. Manage Tabs is the modal Sidebar's "Manage
  Tabs" button opens: every tab reorders (drag) and hides here, but only a tab a user
  added renames or deletes — delete asks Confirm Dialog first.
- Settings page: Settings Sidebar (same rail as Sidebar.dc.html, same size), Display
  Settings (theme — light/dark/system — and accent), Homebrew (items and spells, one
  tab), Sources.
- Overlays: Roll Toast, Confirm Dialog, Add Widget Picker.
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
  the picker. Built-in tabs (Overview, Inventory, Spells, Features, Identity, Level,
  Alignment, Backstory, Notes) never get this — their widgets are fixed.
- Reference: Popover and Modal show the two interaction patterns below in isolation,
  always open, so they can be reviewed without hovering or clicking inside a live widget.
  List Item shows the row shape shared by Weapons, Armor, Gear, Known Spells, and the
  Features widgets — design it here first, then carry a change into each widget's rows.
- Filters: WeaponsFilter, ArmorFilter, GearFilter, SpellListFilter, ClassFeaturesFilter,
  RaceFeaturesFilter, ChosenFeaturesFilter — each is mounted into its list widget from a
  Filter button in that widget's header, and sits next to that widget on the canvas.

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
item's fuller detail. Both share one card style: white background, `#dde1e6` border, a
bold label line over a muted body line.

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

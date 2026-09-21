# UI mockup

An interactive character sheet mockup, built while exploring the `packages/web` UI
before writing any of it. It runs entirely on static, hand-authored sample data — four
characters, no `content.db`, no API — so it is reference for layout and interaction, not
a prototype of the real app.

Live, editable version: <https://claude.ai/artifact/RkebCoeH7kYaMb8XZAAhSS>

## What is here

The three files this artifact publishes:

| File | What it is |
|---|---|
| `canvas.json` | Layout: which artboard sits where, and at what size |
| `Sheet.dc.html` | The desktop character sheet — tabs, widgets, search, everything interactive |
| `Mobile.dc.html` | A phone-width pass over the same character |

They are Design Components, a claude.ai artifact format: plain HTML with inline styles
and a small `<script type="text/x-dc">` block per file driving the interactive state.
They do not run standalone in a browser — open the live link above to interact with
them, or read the markup here for the shapes and interactions it settled on.

## Covered

Ability scores, saves, and skills (with custom, non-ability-based skills); a widget-based
Overview tab a user can resize, reorder, and add to; inventory split into weapons, armor,
and gear, gated by proficiency to equip; spell slots as a per-level, clickable pip
tracker; short and long rest; temporary HP; status effects and resistances/immunities;
a global search across characters and a sample compendium; light and dark mode; and a
user-customizable accent color.

## Known gaps

Carried over from the mockup's own review notes — not done, not started:

- Only the Overview tab is widget-based; Inventory, Spells, Features, Identity,
  Backstory, and Notes are still fixed layouts.
- Race and class are free text, not a corpus lookup — no multiclassing or subclass
  modeling.
- No keyboard navigation through the search dropdowns.
- Clicking a compendium search result adds it directly; there is no detail view first.
- Widget resize is click-to-cycle between three sizes, not a continuous drag.

## Component mockups

Refining one piece of `Sheet.dc.html` meant reloading the whole 1440×1140 page, so
`docs/mockup/components/` breaks it apart: one artboard per component, each running its
own sample data and state instead of a shared "current character". Iterate on a single
piece here before folding a change back into the full sheet.

Live, editable version: <https://claude.ai/artifact/LCpPbSnvJ7J8hesrvYJhpM>

`Layout.dc.html` is a labeled wireframe of the page structure — top bar, collapsible
sidebar, content region, plus an optional character-header row — shared by the
character sheet and the settings page alike; read it first to see how the pieces fit
together. Every other file matches a widget, panel, or nav element:

- Overview: the eight widgets (Abilities, Saves, Skills, Combat, HP, Attacks, Status,
  Defenses).
- Inventory: Currency, Weapons, Armor, Gear.
- Spells: Spell Slots, Known Spells.
- Features, Backstory, Notes.
- Identity: Name, Race, Class, Background, Languages, Proficiencies — each its own
  widget. Level (level, leveling mode, experience) and Alignment are their own sidebar
  tabs, not part of Identity.
- Page chrome: Sidebar (now the tab rail — the character list moved to the top bar's
  Character menu), Top Bar Navigation (Character menu, Mechanics menu, search,
  Settings), Character Header.
- Settings page: Settings Sidebar (same rail as Sidebar.dc.html, same size), Display
  Settings (theme — light/dark/system — and accent), Homebrew (items and spells, one
  tab), Sources. Replaces the old Settings modal.
- Overlays: Roll Toast, Confirm Dialog, Add Widget Picker.

Simplifications specific to the split-out versions:
- AC is a flat editable stat, not derived from equipped armor — that computation lives
  with Inventory in the full sheet.
- Weapons and Armor use a narrower sample proficiency list than Elara's, so both the
  allowed and the proficiency-blocked equip states show up.
- Race and Background pick from a small fixed sample list, not the real catalog; Class
  is multi-select (chips, each with its own level) to cover multiclassing.
- Homebrew items and spells edit by replacing the whole pasted entry, per
  `docs/data-model.md`'s rule that homebrew rows are written once and never edited field
  by field — there's no per-field form.

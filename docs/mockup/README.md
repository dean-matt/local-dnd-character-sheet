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

`Layout.dc.html` is a labeled wireframe of the page structure (top bar, sidebar, header,
tab bar, content region) at the full sheet's dimensions — read it first to see how the
pieces fit together. Every other file matches a widget or panel from `Sheet.dc.html`:
the eight Overview widgets, Inventory (Currency, Weapons, Armor, Gear), Spells (Spell
Slots, Known Spells), Features, Identity, Languages, Proficiencies, Backstory, Notes,
the page chrome (Sidebar, Top Bar Search, Character Header, Tab Bar), and the three
overlays (Roll Toast, Confirm Dialog, Settings Panel, Add Widget Picker).

Simplifications specific to the split-out versions:
- AC is a flat editable stat, not derived from equipped armor — that computation lives
  with Inventory in the full sheet.
- Weapons and Armor use a narrower sample proficiency list than Elara's, so both the
  allowed and the proficiency-blocked equip states show up.

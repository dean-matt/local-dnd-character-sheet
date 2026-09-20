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

# Design tokens

`packages/web/src/index.css` defines a small vocabulary on top of Tailwind's theme, in one
`@theme` block. A view naming a raw hex or an arbitrary size (`text-[13px]`,
`bg-[#f4f5f7]`) is the exception that has to justify itself; everything else pulls from
this list or from Tailwind's scale.

## The register

The sheet is a dense reference: small type and tight rows where the numbers are,
current-density spacing and controls around them. A player scans it mid-turn rather than
browsing it.

| Token | Value | What it is |
|---|---|---|
| `text-row` | `0.75rem` (12px), Tailwind's `text-xs` | Body text in list rows, labels, table cells |
| `text-number` | `1.25rem` (20px), Tailwind's `text-xl` | A stat, a modifier, an HP value — anywhere a number is the thing being read |
| `spacing-row` | `2rem` (32px) | The height of one dense list row (`h-row`, `min-h-row`) |
| `radius-card` | `0.5rem` (8px), Tailwind's `radius-lg` | The corner radius for a card or panel |

`text-row` and `text-number` name existing Tailwind sizes, so a view reaches for "the row
size" or "the number size" rather than picking `text-xs` or `text-xl` by convention — a
convention drifts the first time someone reaches for `text-sm` instead.

## Color

One toned neutral ground (Tailwind's `gray`, a cool rather than warm gray) plus one
accent, aliased so a view names the role rather than the shade:

| Token | Maps to | Role |
|---|---|---|
| `color-canvas` | `gray-100` | Page background |
| `color-surface` | `white` | Card and panel background |
| `color-border` | `gray-200` | Hairline borders |
| `color-ink` | `gray-900` | Primary text |
| `color-muted` | `gray-500` | Secondary text — labels, captions |
| `color-accent` | `#c1272d` | The one thing the accent means: interactive emphasis — a roll, a primary action, a hover or focus state. Never decoration. |
| `color-accent-hover` / `color-accent-active` | `color-mix(in oklab, var(--color-accent) 85%/70%, black)` | Pressed states for the accent, mixed from it so a future accent change carries through |

`color-accent` reuses the default `docs/mockup/` already settled on — every widget's
accent prop there defaults to the same value. Picking a different one here would leave
the sheet and the mockup it follows disagreeing on the one color meant to carry meaning.

## Focus and contrast

A single `:focus-visible` rule in `index.css` outlines the accent color around whatever
has focus, so a view inherits it instead of each one styling its own outline. Contrast,
checked once against these tokens rather than per view:

- `color-accent` on `color-surface`: 5.84:1 — passes WCAG AA for text of any size
- `color-muted` on `color-surface`: 4.83:1 — passes WCAG AA for normal text
- `color-ink` on `color-surface` or `color-canvas`: >15:1

## Worked example

`packages/web/src/App.tsx` renders a card against these tokens — surface, border,
`radius-card`, `text-row` labels, a `text-number` stat, and the accent on its one
interactive control. The next view to land copies its shape rather than reinventing one.

## Out of scope here

Dark mode, print, motion, and a component library as a dependency. Components are
shadcn/ui, copied in one at a time when a view first needs one, per `CLAUDE.md`.

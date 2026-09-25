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

## Motion

The sheet is read for its numbers, not its transitions. Most of it does not move at all:

| Token | Value | Used for |
|---|---|---|
| `duration-standard` | `150ms` | A popover opening or closing, a tab changing — content changing state in place |
| `ease-standard` | Tailwind's `ease-out` | Paired with `duration-standard` |

A page change is a route change and gets nothing beyond what the router does for free —
no crossfade, no slide. Everything else gets nothing: no hover transition, no entrance
animation, and never a transition or animation on a `text-number` element, where
movement would fight the read.

`index.css` also carries a global `prefers-reduced-motion: reduce` rule that collapses
every `animation-duration` and `transition-duration` to near zero, so a reduced-motion
reader gets the same policy without a component opting in.

## Worked example

`packages/web/src/states.tsx` renders its loading, error and empty cards against these
tokens — surface, border, `radius-card` and `text-row` — and every route reuses them
rather than inventing its own. The next view with a number to show is the first to reach
for `text-number`.

## Print

A character prints from the browser's own print. `CharacterLayout` renders every page
the nav lists into a `data-print-sheet` element that is hidden on screen, and print shows
that element in place of the screen page, each page starting a new sheet. A hidden page
stays out of the nav, so it stays out of the print.

- **Chrome:** the header, the page nav and its Manage pages control, the feature filter
  and the disclosure arrows carry `print:hidden`. A new screen-only control takes it too.
- **Palette:** print uses the light tokens whatever the screen theme, with
  `color-border` raised to `gray-300` so hairlines survive the printer.
- **Size:** `text-row` becomes `12pt`, the floor for printed body text.
- **Breaks:** a heading stays with what follows it, and a list row, table row or
  definition pair never splits across pages.
- **Breakdowns are omitted.** A popover has no printed form, so the value prints alone,
  and a collapsed spell, item or feature prints its header without its rules text.

## Out of scope here

A component library as a dependency. Components are shadcn/ui, copied in one at a time
when a view first needs one, per `CLAUDE.md`.

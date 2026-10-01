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
| `font-sans` | `"Noto Sans Variable"`, then the system sans | The one typeface, weights 400–700, self-hosted from `@fontsource-variable/noto-sans` so the sheet renders with no network |
| `text-row` | `0.75rem` (12px), Tailwind's `text-xs` | Body text in list rows, labels, table cells |
| `text-number` | `1.25rem` (20px), Tailwind's `text-xl` | A stat, a modifier, an HP value — anywhere a number is the thing being read |
| `text-chip` | `0.5625rem` (9px) | A chip's label |
| `tracking-chip` | `0.04em` | A chip's letter spacing |
| `text-label` | `0.6875rem` (11px) | A section label |
| `text-body` | `0.8125rem` (13px) | Body text and a control's label |
| `text-title` | `0.9375rem` (15px) | A modal's title |
| `spacing-row` | `2rem` (32px) | The height of one dense list row (`h-row`, `min-h-row`) |
| `spacing-topbar` | `4rem` (64px) | The top bar's height, and the offset of everything sticky or sized under it |
| `spacing-header` | `3.25rem` (52px) | The character header's height, and its share of the pinned offset under the top bar |
| `spacing-gutter` | `2.5rem` (40px) | The side inset of the character header and the page content |
| `spacing-sidebar` | `16.25rem` (260px) | The sidebar's width |
| `spacing-sidebar-collapsed` | `4.5rem` (72px) | The sidebar's width as an icon rail |
| `radius-chip` | `0.25rem` (4px), Tailwind's `radius-sm` | A chip |
| `radius-control` | `0.375rem` (6px), Tailwind's `radius-md` | A button, an input, a row tile |
| `radius-card` | `0.5rem` (8px), Tailwind's `radius-lg` | A card, panel or modal. The mockup draws cards at 8px and dialogs at 10px; the sheet uses 8px for both |
| `radius-pill` | `calc(infinity * 1px)` | A pill button |
| `shadow-popover` | `0 16px 32px`, black at 18% (50% dark) | A popover or menu |
| `shadow-modal` | `0 24px 48px`, black at 18% (50% dark) | A modal dialog |

The top bar takes Tailwind's radii rather than these, because its mockup draws its own:
4px triggers (`rounded-sm`), a 12px menu panel (`rounded-xl`) and 8px menu rows
(`rounded-lg`). A change to `radius-control` or `radius-card` leaves the bar alone.

`text-row` and `text-number` name existing Tailwind sizes, so a view reaches for "the row
size" or "the number size" rather than picking `text-xs` or `text-xl` by convention — a
convention drifts the first time someone reaches for `text-sm` instead.

## Color

One cool neutral ground, one accent and a gold for a price, aliased so a view names the
role rather than the shade:

| Token | Light | Dark | Role |
|---|---|---|---|
| `color-canvas` | `#f4f5f7` | `gray-900` | Page background |
| `color-surface` | `white` | `gray-800` | Card and panel background |
| `color-subtle` | `#eef0f3` | `gray-700` and `gray-800`, mixed evenly | A row tile or a track inside a card. The mockup's `#eceef1` folds into it |
| `color-border` | `#dde1e6` | `gray-700` | Hairline borders |
| `color-ink` | `#1f2430` | `gray-100` | Primary text |
| `color-secondary` | `#4b5260` | `gray-300` | Text a step down from ink — an unselected nav label |
| `color-muted` | `#6b7280` 92%, `color-ink` 8% | `gray-400` | Quiet text — labels, captions |
| `color-placeholder` | `color-muted` | `color-muted` | Placeholder text |
| `color-scrim` | `rgb(15 17 21 / 0.5)` | black at 60% | A modal's backdrop |
| `color-accent` | `#c1272d` | `#c1272d` 90%, white 10% | The one thing the accent means: interactive emphasis — a roll, a primary action, a hover or focus state. Never decoration. |
| `color-accent-text` | `#c1272d` | `#c1272d` 60%, white 40% | The accent as text under the large-text size — a link, the wordmark, an override mark, the top bar's current section |
| `color-accent-hover` / `color-accent-active` | `color-mix(in oklab, var(--color-accent) 85%/70%, black)` | the same mix | Pressed states for the accent, mixed from it so a future accent change carries through |
| `color-accent-tint` | `color-mix(in oklab, var(--color-accent) 10%, var(--color-canvas))` | the same mix | The ground of a selected state |
| `color-money` / `color-money-tint` / `color-money-border` | `#7a5b00` on `#fbf3dc`, edged `#e5cf8f` | `#e5cf8f` on `#7a5b00` 30% into `gray-800`, edged at 70% | A list row's price chip |

Two light values depart from the mockup. `#6b7280` measures 4.43:1 on canvas and 4.23:1
on subtle, under AA, so `color-muted` takes 8% of the ink. `#9aa1ab` measures 2.61:1 on
surface, and `color-muted` sits within 0.3 of 4.5:1 on subtle in both themes, too close
for a visibly lighter gray, so `color-placeholder` aliases `color-muted`.
`color-accent-tint` mixes into canvas rather than surface because the dark accent
measures 3.10:1 on the dark surface already, which is also why small accent text takes
`color-accent-text` instead.

`color-accent` reuses the default `docs/mockup/` already settled on — every widget's
accent prop there defaults to the same value. Picking a different one here would leave
the sheet and the mockup it follows disagreeing on the one color meant to carry meaning.

## Focus and contrast

A single `:focus-visible` rule in `index.css` outlines the accent color around whatever
has focus, so a view inherits it instead of each one styling its own outline. `main`, which
takes focus on every navigation, is the one exception. Contrast is checked once against
these tokens rather than per view. `packages/web/src/contrast.test.ts`
holds every pair in both themes and fails a repalette that regresses one:

- `color-ink`, `color-muted` and `color-placeholder` on `color-canvas`, `color-surface` and `color-subtle`:
  AA for normal text
- `color-secondary` on `color-surface` and `color-subtle`: AA for normal text
- `color-accent-text` on `color-canvas`, `color-surface` and `color-subtle`: AA for normal text
- `color-accent` on `color-accent-tint`: AA for text in light, 3:1 in dark
- The focus ring in each accent shade on `color-canvas`: 3:1
- The loading spinner's `color-muted` arc on its `color-border` track: 3:1

## Motion

The sheet is read for its numbers, not its transitions. Most of it does not move at all:

| Token | Value | Used for |
|---|---|---|
| `duration-standard` | `150ms` | A popover opening or closing, a tab changing — content changing state in place |
| `ease-standard` | Tailwind's `ease-out` | Paired with `duration-standard` |

A page change is a route change and gets nothing beyond what the router does for free —
no crossfade, no slide. The loading spinner turns while a request is in flight. Everything
else gets nothing: no hover transition, no entrance animation, and never a transition or
animation on a `text-number` element, where movement would fight the read.

`index.css` also carries a global `prefers-reduced-motion: reduce` rule that collapses
every `animation-duration` and `transition-duration` to near zero and plays an animation
once, so a reduced-motion reader gets the same policy without a component opting in and the
spinner holds still.

## Worked example

`packages/web/src/StateCard.tsx` draws the card the loading, error and empty states share
against these tokens — surface, border, `radius-card` and `text-row` — and every route reuses them
rather than inventing its own. `LoadingState` draws a muted spinner in place of the text. The next view with a number to show is the first to reach
for `text-number`.

## Print

A character prints from the browser's own print. `CharacterLayout` renders every page
the nav lists into a `data-print-sheet` element that is hidden on screen, and print shows
that element in place of the screen page, each page starting a new sheet. A hidden page
stays out of the nav, so it stays out of the print.

- **Chrome:** the header, the page nav and its Manage pages control, the feature filter
  and the disclosure arrows carry `print:hidden`. A new screen-only control takes it too.
- **Palette:** the dark theme applies on screen alone, so print keeps the light tokens.
  Canvas, subtle and the accent tint print white, and `color-border` takes 10% of the
  ink so hairlines survive the printer.
- **Size:** `text-row` becomes `12pt`, the floor for printed body text.
- **Breaks:** a heading stays with what follows it, and a list row, table row or
  definition pair never splits across pages.
- **Breakdowns and rules text are omitted.** A popover has no printed form, so the value
  prints alone. The print copy keeps its own disclosure state, closed, so every spell,
  item and feature prints its header without its rules text, whatever is open on screen.

## Out of scope here

A component library as a dependency. Components are shadcn/ui, copied in one at a time
when a view first needs one, per `CLAUDE.md`.

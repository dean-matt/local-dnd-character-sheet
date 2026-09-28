# Page chrome

How the pieces around a page grow. `docs/mockup/components/Layout.dc.html` fixes the
arrangement at 1440px and says nothing about stretching, so this is the rule for that.

- **Top bar** is full-bleed above everything. Nothing beside it changes its width. Its
  height is `--spacing-topbar` in `src/index.css`; anything sized against it uses the token.
- **Sidebar** fills its column, sticky under the top bar. Its widths are `--spacing-sidebar` and `--spacing-sidebar-collapsed`.
- **Character header** fills the content column, so it grows and shrinks with the side
  panels. Character sheet only; Settings skips it.
- **Page content** sits in the content column below the header, with its own inset.

A side panel joins the flex row in `src/routes/CharacterLayout.tsx`. The content column
and the character header follow it; the top bar never does. The mockup's Rolls Panel, a
right-docked collapsible rail, is the first one expected.

## Traps

- **Non-character pages use another inset.** The list, catalog and 404 pages sit in
  `ContentLayout` in `router.tsx` (`p-4 sm:p-8`) with no sidebar or header, so their edges
  do not line up with a character page's.
- **New chrome opts out of print.** Print hides every bar with `print:hidden` and renders
  `PrintSheet` and `PrintTitle` from `CharacterLayout.tsx` and `CharacterHeader.tsx`
  instead.

## Not built

No narrow-width layout, and no Settings page with its own sidebar.

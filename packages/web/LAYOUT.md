# Page chrome

How the pieces around a page grow. `docs/mockup/components/Layout.dc.html` fixes the
arrangement at 1440px and says nothing about stretching, so this is the rule for that.

- **Top bar** is full-bleed above everything. Nothing beside it changes its width. Its
  height is `--spacing-topbar` in `src/index.css`; anything sized against it uses the token.
  Its own content sits at 24px, not the gutter, as the mockup draws it.
- **Sidebar** fills its column, sticky under the top bar. Its widths are `--spacing-sidebar` and `--spacing-sidebar-collapsed`.
  The character sheet and Settings share one rail, `Sidebar` in `src/routes/Sidebar.tsx`, one
  collapsed state, and one row around it, `SidebarFrame` in the same file.
- **Character header** fills the content column, so it grows and shrinks with the side
  panels. Character sheet only; Settings skips it.
- **Page content** sits below the header with `px-gutter py-6`, on character pages, on
  Settings, and in `ContentLayout` in `router.tsx`, which the list, catalog and 404 pages use.

A side panel joins the flex row in `src/routes/CharacterLayout.tsx`. The content column
and the character header follow it; the top bar never does. The mockup's Rolls Panel, a
right-docked collapsible rail, is the first one expected.

## Traps

- **New chrome opts out of print.** Print hides every bar with `print:hidden` and renders
  `PrintSheet` and `PrintTitle` from `CharacterLayout.tsx` and `CharacterHeader.tsx`
  instead.

## Not built

No narrow-width layout.

# Page chrome

How the pieces around a page grow. `docs/mockup/components/Layout.dc.html` fixes the
arrangement at 1440px and says nothing about stretching, so this is the rule for that.

- **Top bar** is full-bleed above everything and pinned to the top of the viewport. Nothing
  beside it changes its width. Its height is `--spacing-topbar` in `src/index.css`; anything
  sized against it uses the token. Its own content sits at 24px, not the gutter, as the
  mockup draws it.
- **Sidebar** fills its column, sticky under the top bar, and scrolls its own rows in a
  window too short to hold them, with its scrollbar hidden so the collapsed icons stay
  centered and `scroll-shadow` shading the clipped edge instead. Its widths are
  `--spacing-sidebar` and `--spacing-sidebar-collapsed`.
  The character sheet, Settings and the creation flow share one collapsible rail, `Rail` in
  `src/routes/Rail.tsx`, one collapsed state, and one row around it, `SidebarFrame` in
  `src/routes/SidebarFrame.tsx`. The first two fill it with `Sidebar` in
  `src/routes/Sidebar/Sidebar.tsx`.
- **Character header** fills the content column, so it grows and shrinks with the side
  panels. Its height is `--spacing-header`, which the name and subtitle hold by truncating.
  It is pinned under the top bar in a window at least 36rem tall, the `tall` variant in
  `src/index.css`. Character sheet only; Settings skips it.
- **Page content** sits below the header with `px-gutter py-6`, on character pages, on
  Settings, and in `ContentLayout` in `src/routes/ContentLayout.tsx`, which the homepage, list and 404 pages use.

A side panel joins the flex row in `src/routes/CharacterLayout/CharacterLayout.tsx`. The content column
and the character header follow it; the top bar never does. The mockup's Rolls Panel, a
right-docked collapsible rail, is the first one expected.

## Traps

- **Pinned chrome stacks under the top bar.** The top bar is `z-30`, so its menus and their
  backdrop cover the character header at `z-20`, which covers the sheet. Chrome pinned below
  the top bar adds its height to `scroll-padding-top` in `src/index.css`, as the character
  header does with `--spacing-header`, or focus lands under it.
- **New chrome opts out of print.** Print hides every bar with `print:hidden` and renders
  `PrintSheet` and `PrintTitle`, in `src/routes/CharacterLayout/PrintSheet/`, instead.

## Not built

No narrow-width layout.

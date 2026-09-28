# Page chrome

How the pieces around a page grow. `docs/mockup/components/Layout.dc.html` fixes the
arrangement at 1440px and says nothing about stretching, so this is the rule for that.

- **Top bar** is full-bleed above everything. Nothing beside it changes its width.
- **Sidebar** fills its column, sticky under the top bar.
- **Character header** fills the content column, so it grows and shrinks with the side
  panels. Character sheet only; Settings skips it.
- **Page content** sits in the content column below the header, with its own inset.

A side panel joins the flex row in `src/routes/CharacterLayout.tsx`. The content column
and the character header follow it; the top bar never does.

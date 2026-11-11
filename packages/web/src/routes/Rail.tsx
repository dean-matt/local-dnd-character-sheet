import { type ReactNode, useState } from "react";
import { CollapseToggle } from "../components/CollapseToggle.tsx";

const COLLAPSED_KEY = "sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(value));
  } catch {}
}

/**
 * The collapsible column beside a page: `children`, drawn for the current state, scrolling
 * above the collapse toggle pinned at its foot. localStorage keeps the choice across reloads,
 * one choice for every rail that draws this.
 */
export function Rail({ children }: { children: (collapsed: boolean) => ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed(next);
  };

  // The collapsed rail has 39px inside its padding and border for 39px rows, so a scrollbar
  // would push the rows off center. Hidden, the rows still scroll by wheel, touch and focus,
  // and scroll-shadow marks the clipped edge. A mouse with no wheel still cannot drag it, and
  // showing a scrollbar needs a wider collapsed width first. The padding sits inside the
  // scroll region, so it does not clip the focus ring of a row at its edge.
  return (
    <div
      className="flex h-full flex-col border-r border-border bg-surface"
      style={{
        width: collapsed ? "var(--spacing-sidebar-collapsed)" : "var(--spacing-sidebar)",
        transition: "width var(--duration-standard)",
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-x-hidden overflow-y-auto [scrollbar-width:none] scroll-shadow px-4 pt-5 pb-2.5">
        {children(collapsed)}
      </div>

      <div className="mx-4 mb-5 border-t border-border pt-3">
        <CollapseToggle
          name="sidebar"
          edge="left"
          collapsed={collapsed}
          onToggle={toggleCollapse}
        />
      </div>
    </div>
  );
}

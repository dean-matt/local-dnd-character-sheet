import { ChevronLeft } from "lucide-react";
import { type ReactNode, useState } from "react";

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
 * The collapsible column beside a page: `children`, drawn for the current state, above the
 * collapse toggle at its foot. localStorage keeps the choice across reloads, one choice for
 * every rail that draws this.
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
  // showing a scrollbar needs a wider collapsed width first.
  return (
    <div
      className="flex h-full flex-col gap-2.5 overflow-x-hidden overflow-y-auto [scrollbar-width:none] scroll-shadow border-r border-border bg-surface px-4 py-5"
      style={{
        width: collapsed ? "var(--spacing-sidebar-collapsed)" : "var(--spacing-sidebar)",
        transition: "width var(--duration-standard)",
      }}
    >
      {children(collapsed)}

      <div className="mt-auto border-t border-border pt-3">
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={toggleCollapse}
          className={`flex w-full items-center gap-3 rounded-control px-2.5 py-2.5 text-sm font-medium text-muted hover:bg-subtle ${collapsed ? "justify-center" : ""}`}
        >
          {/* The margin widens the 16px arrow to the rows' 19px icon column, so it centers under them. */}
          <ChevronLeft
            size={16}
            className="mx-[1.5px] shrink-0"
            style={{
              transform: collapsed ? "rotate(180deg)" : undefined,
              transition: "transform var(--duration-standard)",
            }}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );
}

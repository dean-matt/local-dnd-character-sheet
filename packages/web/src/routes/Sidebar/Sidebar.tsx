import { type ReactNode, useState } from "react";
import { NavLink } from "react-router";
import { SidebarRowIcon } from "./SidebarRowIcon.tsx";

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

/** `end` marks the row active on its own path alone, not on the paths beneath it. */
type SidebarItem = { to: string; label: string; icon?: readonly string[]; end?: boolean };

export interface SidebarProps {
  label: string;
  items: SidebarItem[];
  action?: (collapsed: boolean) => ReactNode;
}

/**
 * The collapsible rail beside a page: a nav of `items`, then an optional `action` above the
 * collapse toggle. Collapsed, it shows icons alone; localStorage keeps that choice across
 * reloads, one choice for every rail.
 */
export function Sidebar({ label, items, action }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed(next);
  };

  const rowBase = `flex items-center gap-3 rounded-control px-2.5 py-2.5 ${collapsed ? "justify-center" : ""}`;

  // The collapsed rail has 39px inside its padding and border for 39px rows, so a scrollbar
  // would push the icons off center. Hidden, the rows still scroll by wheel, touch and focus,
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
      <nav aria-label={label} className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            aria-label={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `${rowBase} ${isActive ? "bg-accent-tint" : "hover:bg-subtle"}`
            }
          >
            {({ isActive }) => (
              <>
                <SidebarRowIcon paths={item.icon} active={isActive} />
                {!collapsed && (
                  <span
                    className={`truncate text-sm ${
                      isActive ? "font-semibold text-ink" : "font-medium text-muted"
                    }`}
                  >
                    {item.label}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      {action?.(collapsed)}

      <div className="border-t border-border pt-3">
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleCollapse}
          className={`${rowBase} w-full text-sm font-medium text-muted hover:bg-subtle`}
        >
          {/* The margin widens the 16px arrow to the rows' 19px icon column, so it centers under them. */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mx-[1.5px] shrink-0"
            aria-hidden
            style={{
              transform: collapsed ? "rotate(180deg)" : undefined,
              transition: "transform var(--duration-standard)",
            }}
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );
}

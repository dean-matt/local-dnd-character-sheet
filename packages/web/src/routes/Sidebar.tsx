import type { CharacterPageRecord } from "@dnd/character";
import { type ReactNode, useState } from "react";
import { NavLink } from "react-router";

/** One or more SVG paths per page slug. */
const PAGE_PATHS: Record<string, readonly string[]> = {
  stats: ["M4 14h4v6H4zM10 9h4v11h-4zM16 4h4v16h-4z"],
  spells: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"],
  inventory: ["M6 7h12l1 13a1 1 0 01-1 1H6a1 1 0 01-1-1z", "M9 7a3 3 0 016 0"],
  features: ["M12 2.5l2.9 6.3 6.9.8-5.1 4.8 1.4 6.9L12 17.6l-6.1 3.7 1.4-6.9-5.1-4.8 6.9-.8z"],
  identity: [
    "M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
    "M7 11a2 2 0 104 0 2 2 0 10-4 0",
    "M6 16c0-1.7 1.3-3 3-3s3 1.3 3 3M14 9h5M14 13h5",
  ],
  level: [
    "M5 14h2a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4a1 1 0 011-1z",
    "M11 9h2a1 1 0 011 1v9a1 1 0 01-1 1h-2a1 1 0 01-1-1v-9a1 1 0 011-1z",
    "M17 4h2a1 1 0 011 1v14a1 1 0 01-1 1h-2a1 1 0 01-1-1V5a1 1 0 011-1z",
  ],
  alignment: [
    "M12 3v3M5 21h14M12 6v12",
    "M4 8l3-2 3 2-3 6a3 3 0 01-3-6z",
    "M14 8l3-2 3 2-3 6a3 3 0 01-3-6z",
  ],
  backstory: [
    "M4 5.5A2.5 2.5 0 016.5 3H19v16.5H6.5A2.5 2.5 0 014 22z",
    "M4 19.5A2.5 2.5 0 016.5 17H19",
  ],
  notes: [
    "M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z",
    "M8 8h8M8 12h8M8 16h5",
  ],
};

function RowIcon({ paths, active }: { paths: readonly string[] | undefined; active: boolean }) {
  const stroke = active ? "var(--color-accent)" : "var(--color-muted)";
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      className="shrink-0"
      aria-hidden
    >
      {paths ? (
        paths.map((d) => <path key={d} d={d} />)
      ) : (
        <>
          <path d="M12 8v8M8 12h8" />
          <circle cx="12" cy="12" r="9" />
        </>
      )}
    </svg>
  );
}

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
export type SidebarItem = { to: string; label: string; icon?: readonly string[]; end?: boolean };

/**
 * The collapsible rail beside a page: a nav of `items`, then an optional `action` above the
 * collapse toggle. Collapsed, it shows icons alone; localStorage keeps that choice across
 * reloads, one choice for every rail.
 */
export function Sidebar({
  label,
  items,
  action,
}: {
  label: string;
  items: SidebarItem[];
  action?: (collapsed: boolean) => ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed(next);
  };

  const rowBase = `flex items-center gap-3 rounded-control px-2.5 py-2.5 ${collapsed ? "justify-center" : ""}`;

  // The collapsed rail has 40px inside its padding for 39px rows, so a classic scrollbar
  // would push the icons off center. Hidden, the rows still scroll by wheel, touch and focus.
  // A rail that must show its scrollbar needs a wider collapsed width first.
  return (
    <div
      className="flex h-full flex-col gap-2.5 overflow-x-hidden overflow-y-auto [scrollbar-width:none] border-r border-border bg-surface px-4 py-5"
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
                <RowIcon paths={item.icon} active={isActive} />
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

/**
 * The row a railed page draws: `rail` sticky under the top bar and out of print, then
 * `children` as the content column beside it.
 */
export function SidebarFrame({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-var(--spacing-topbar))]">
      <aside className="sticky top-topbar h-[calc(100vh-var(--spacing-topbar))] shrink-0 self-start print:hidden">
        {rail}
      </aside>
      {children}
    </div>
  );
}

/** The character sheet's rail: one row per visible page, and the Manage pages button. */
export function CharacterSidebar({
  characterId,
  pages,
  onManage,
  manageButtonRef,
}: {
  characterId: string;
  pages: CharacterPageRecord[];
  onManage: () => void;
  manageButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <Sidebar
      label="Character pages"
      items={pages.map((page) => ({
        to: `/characters/${characterId}/p/${page.slug}`,
        label: page.title,
        icon: PAGE_PATHS[page.slug],
      }))}
      action={(collapsed) => (
        <button
          ref={manageButtonRef}
          type="button"
          aria-label={collapsed ? "Manage pages" : undefined}
          aria-haspopup="dialog"
          onClick={onManage}
          className={`flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm font-medium text-muted hover:bg-subtle ${collapsed ? "justify-center" : ""}`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M8 6h13M8 12h13M8 18h13" />
            <path d="M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          {!collapsed && <span>Manage pages</span>}
        </button>
      )}
    />
  );
}

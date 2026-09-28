import type { CharacterPageRecord } from "@dnd/character";
import { useState } from "react";
import { NavLink } from "react-router";

/** One or more SVG paths per page slug. */
const PAGE_PATHS: Record<string, readonly string[]> = {
  stats: ["M4 14h4v6H4zM10 9h4v11h-4zM16 4h4v16h-4z"],
  spells: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"],
  inventory: ["M6 7h12l1 13a1 1 0 01-1 1H6a1 1 0 01-1-1z", "M9 7a3 3 0 016 0"],
  features: ["M12 2.5l2.9 6.3 6.9.8-5.1 4.8 1.4 6.9L12 17.6l-6.1 3.7 1.4-6.9-5.1-4.8 6.9-.8z"],
  backstory: [
    "M4 5.5A2.5 2.5 0 016.5 3H19v16.5H6.5A2.5 2.5 0 014 22z",
    "M4 19.5A2.5 2.5 0 016.5 17H19",
  ],
  notes: [
    "M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z",
    "M8 8h8M8 12h8M8 16h5",
  ],
};

function PageIcon({ slug, active }: { slug: string; active: boolean }) {
  const paths = PAGE_PATHS[slug];
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

/**
 * Character sheet tab sidebar. Collapses to an icon rail; the choice persists
 * across reloads via localStorage. The Manage button delegates to the caller
 * so the modal can be managed at layout level.
 */
export function Sidebar({
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
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed(next);
  };

  const rowBase = `flex items-center gap-3 rounded-control px-2.5 py-2.5 ${collapsed ? "justify-center" : ""}`;

  return (
    <div
      className="flex h-full flex-col gap-2.5 border-r border-border bg-surface px-4 py-5"
      style={{
        width: collapsed ? "var(--spacing-sidebar-collapsed)" : "var(--spacing-sidebar)",
        transition: "width var(--duration-standard)",
      }}
    >
      <nav aria-label="Character pages" className="flex flex-col gap-0.5">
        {pages.map((page) => (
          <NavLink
            key={page.slug}
            to={`/characters/${characterId}/p/${page.slug}`}
            className={({ isActive }) =>
              `${rowBase} ${isActive ? "bg-accent-tint" : "hover:bg-subtle"}`
            }
          >
            {({ isActive }) => (
              <>
                <PageIcon slug={page.slug} active={isActive} />
                {!collapsed && (
                  <span
                    className={`truncate text-sm ${
                      isActive ? "font-semibold text-ink" : "font-medium text-muted"
                    }`}
                  >
                    {page.title}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

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

      <div className="border-t border-border pt-3">
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleCollapse}
          className={`flex items-center gap-2.5 rounded-control px-2 py-2 text-sm font-medium text-muted hover:bg-subtle ${collapsed ? "justify-center" : ""}`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
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

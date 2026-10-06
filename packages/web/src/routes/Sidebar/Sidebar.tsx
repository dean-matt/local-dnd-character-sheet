import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { Rail } from "../Rail.tsx";

/** `end` marks the row active on its own path alone, not on the paths beneath it. */
type SidebarItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

export interface SidebarProps {
  label: string;
  items: SidebarItem[];
  action?: (collapsed: boolean) => ReactNode;
}

/**
 * The rail beside a page: a nav of `items`, then an optional `action` above the collapse
 * toggle. Collapsed, it shows icons alone.
 */
export function Sidebar({ label, items, action }: SidebarProps) {
  return (
    <Rail>
      {(collapsed) => {
        const rowBase = `flex items-center gap-3 rounded-control px-2.5 py-2.5 ${collapsed ? "justify-center" : ""}`;
        return (
          <>
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
                      <item.icon
                        size={19}
                        color={isActive ? "var(--color-accent)" : "var(--color-muted)"}
                        className="shrink-0"
                      />
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
          </>
        );
      }}
    </Rail>
  );
}

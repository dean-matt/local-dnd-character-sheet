import { X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The column docked at the sheet's right edge, the counterpart to the rail on its left:
 * sticky under the top bar, out of print, holding `children` under a close button at its
 * top right that calls `onClose`. `label` names the dock rather than a panel; each panel
 * names itself with its heading, so another can join this one. `collapsed` narrows it to a
 * strip with no close button, leaving the panel to draw its own expand control.
 */
export function Dock({
  id,
  label,
  onClose,
  collapsed = false,
  children,
}: {
  id: string;
  label: string;
  onClose: () => void;
  collapsed?: boolean;
  children: ReactNode;
}) {
  return (
    <aside
      id={id}
      aria-label={label}
      className="sticky top-topbar flex h-[calc(100vh-var(--spacing-topbar))] shrink-0 flex-col self-start border-border border-l bg-surface px-4 py-5 print:hidden"
      style={{
        width: collapsed ? "var(--spacing-sidebar-collapsed)" : "20rem",
        transition: "width var(--duration-standard)",
      }}
    >
      {!collapsed && (
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${label.toLowerCase()}`}
          title="Close"
          className="absolute top-4 right-3 flex size-8 items-center justify-center rounded-control text-muted hover:bg-subtle hover:text-ink"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </aside>
  );
}

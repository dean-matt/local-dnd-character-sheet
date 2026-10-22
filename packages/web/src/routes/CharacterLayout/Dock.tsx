import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The column docked at the sheet's right edge, the counterpart to the rail on its left:
 * sticky under the top bar, out of print, holding `children` above a collapse button that
 * calls `onCollapse`. Each panel it holds names itself, so another can join this one.
 */
export function Dock({
  id,
  label,
  onCollapse,
  children,
}: {
  id: string;
  label: string;
  onCollapse: () => void;
  children: ReactNode;
}) {
  return (
    <aside
      id={id}
      aria-label={label}
      className="sticky top-topbar flex h-[calc(100vh-var(--spacing-topbar))] w-80 shrink-0 flex-col gap-2.5 self-start border-border border-l bg-surface px-4 py-5 print:hidden"
    >
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <div className="border-border border-t pt-3">
        <button
          type="button"
          onClick={onCollapse}
          className="flex w-full items-center gap-3 rounded-control px-2.5 py-2.5 font-medium text-muted text-sm hover:bg-subtle"
        >
          <ChevronRight size={16} aria-hidden="true" className="shrink-0" />
          <span>Collapse</span>
        </button>
      </div>
    </aside>
  );
}

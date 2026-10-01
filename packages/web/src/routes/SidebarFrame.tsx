import type { ReactNode } from "react";

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

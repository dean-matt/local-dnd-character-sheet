import type { ReactNode } from "react";

/**
 * The row a railed page draws: `rail` sticky under the top bar and out of print, named by
 * `label` where it holds no landmark of its own, then `children` as the content column
 * beside it.
 */
export function SidebarFrame({
  rail,
  label,
  children,
}: {
  rail: ReactNode;
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-var(--spacing-topbar))]">
      <aside
        aria-label={label}
        className="sticky top-topbar h-[calc(100vh-var(--spacing-topbar))] shrink-0 self-start print:hidden"
      >
        {rail}
      </aside>
      {children}
    </div>
  );
}

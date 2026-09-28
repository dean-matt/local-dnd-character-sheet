import type { ReactNode } from "react";

/** A chip beside a list row's name, such as Prepared or Equipped. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-chip border border-border bg-surface px-1.25 py-0.5 font-bold text-chip text-muted uppercase tracking-chip">
      {children}
    </span>
  );
}

import type { ReactNode } from "react";

/** A short mark beside a list row's name, such as Prepared or Equipped. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-card border border-border px-1 text-muted text-row">{children}</span>
  );
}

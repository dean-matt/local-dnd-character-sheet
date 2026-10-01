import type { ReactNode } from "react";

/** The shape every chip shares, whatever its colors. */
export const CHIP = "rounded-chip border px-1.25 py-0.5 font-bold text-chip tracking-chip";

/** A chip, such as Prepared or Equipped beside a row's name. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className={`${CHIP} border-border bg-surface text-muted uppercase`}>{children}</span>
  );
}

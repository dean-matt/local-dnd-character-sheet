import type { ReactNode } from "react";
import { CHIP } from "../lib/chipStyles.ts";

/** A chip, such as Prepared or Equipped beside a row's name. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className={`${CHIP} border-border bg-surface text-muted uppercase`}>{children}</span>
  );
}

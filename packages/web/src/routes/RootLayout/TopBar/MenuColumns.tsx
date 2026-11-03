import type { ReactNode } from "react";

export interface MenuColumnsProps {
  /** Tailwind width and column-count classes, written out whole so the compiler sees them. */
  layout: string;
  children: ReactNode;
}

/**
 * The entries of a top-bar menu, filled down each column before the next. CSS columns keep
 * the DOM order the reading order, so Tab follows it. Below `sm` the entries stay in one column.
 */
export function MenuColumns({ layout, children }: MenuColumnsProps) {
  return (
    <div data-menu-columns className={`${layout} gap-x-0.5 [&>*]:break-inside-avoid`}>
      {children}
    </div>
  );
}

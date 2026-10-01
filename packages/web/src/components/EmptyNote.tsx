import type { ReactNode } from "react";

/** What a card shows in place of a value it has none of. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-muted text-row italic">{children}</p>;
}

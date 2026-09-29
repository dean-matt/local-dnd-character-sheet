import type { ReactNode } from "react";

const CHIP = "rounded-pill border border-border bg-subtle px-2.5 py-1 text-row";

/** What a card shows in place of a value it has none of. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-muted text-row italic">{children}</p>;
}

/** A wrapping row of pill chips, or `empty` in their place when there are none. */
export function ChipList({ labels, empty }: { labels: readonly string[]; empty?: string }) {
  if (labels.length === 0) return empty ? <EmptyNote>{empty}</EmptyNote> : null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {labels.map((label, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: two chips can share a label, and the list is redrawn whole.
        <li key={index} className={CHIP}>
          {label}
        </li>
      ))}
    </ul>
  );
}

import { PILL } from "../lib/chipStyles.ts";
import { EmptyNote } from "./EmptyNote.tsx";

/** A wrapping row of pill chips, or `empty` in their place when there are none. */
export function ChipList({ labels, empty }: { labels: readonly string[]; empty?: string }) {
  if (labels.length === 0) return empty ? <EmptyNote>{empty}</EmptyNote> : null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {labels.map((label, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: two chips can share a label, and the list is redrawn whole.
        <li key={index} className={PILL}>
          {label}
        </li>
      ))}
    </ul>
  );
}

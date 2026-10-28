/**
 * The layout every homebrew row list shares: its controls sharing one line evenly, whatever
 * their count, and the remove button at its end.
 */
export const ROW = "flex items-end gap-2 *:min-w-0 *:flex-1 *:last:flex-none";

export const ROW_BUTTON =
  "rounded-control border border-border bg-surface px-3 py-2 font-semibold text-ink text-row hover:bg-subtle";

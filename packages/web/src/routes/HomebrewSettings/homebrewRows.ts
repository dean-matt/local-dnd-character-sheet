/**
 * The layout every homebrew row list shares: up to four controls and a Remove button on one
 * line where the form is wide, two to a line where it is not.
 */
export const ROW = "grid grid-cols-2 items-end gap-2 @2xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]";

export const ROW_BUTTON =
  "rounded-control border border-border bg-surface px-3 py-2 font-semibold text-ink text-row hover:bg-subtle";

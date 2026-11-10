import type { CSSProperties } from "react";

/** A CSS anchor name unique to `id`, such as one `useId` returns. */
export function anchorName(id: string): string {
  return `--anchor${id.replace(/[^\w-]/g, "")}`;
}

/** Undoes the user agent's centering of an element shown in the top layer. */
export const ANCHORED_CLASSES = "inset-auto m-0";

/**
 * Places an element drawn in the top layer beside the control named `anchor`, in `area`,
 * flipping to the opposite side or edge where the viewport has no room for it.
 */
export function anchoredStyle(anchor: string, area: string): CSSProperties {
  return {
    positionAnchor: anchor,
    positionArea: area,
    positionTryFallbacks: "flip-block, flip-inline, flip-block flip-inline",
    positionVisibility: "anchors-visible",
  };
}

/** Classes for a top-layer list: undo the user agent's centering, then set the gap and text color. */
export const ANCHORED_LIST_CLASSES = `${ANCHORED_CLASSES} mt-1 text-ink`;

/**
 * Places a list drawn in the top layer under the control named `anchor`, at least as wide as
 * it. The list opens on whichever side of the control has more room, and its height stops
 * at the viewport's edge, so it never runs off the screen.
 */
export function anchoredListStyle(anchor: string): CSSProperties {
  return {
    positionAnchor: anchor,
    positionArea: "bottom span-right",
    positionTryFallbacks: "flip-block",
    positionTryOrder: "most-height",
    positionVisibility: "anchors-visible",
    width: "anchor-size(width)",
    minWidth: "anchor-size(width)",
    maxHeight: "min(20rem, 100% - 0.5rem)",
  };
}

/** The floating list's look, shared by the dropdowns and the combobox. */
export const DROPDOWN_PANEL = `${ANCHORED_LIST_CLASSES} flex flex-col overflow-y-auto rounded-control border border-border bg-surface p-1.5 shadow-popover outline-none`;

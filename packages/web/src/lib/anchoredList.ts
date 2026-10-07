import type { CSSProperties } from "react";

/** A CSS anchor name unique to `id`, such as one `useId` returns. */
export function anchorName(id: string): string {
  return `--anchor${id.replace(/[^\w-]/g, "")}`;
}

/** Classes for a top-layer list: undo the user agent's centering, then set the gap and text color. */
export const ANCHORED_LIST_CLASSES = "inset-auto m-0 mt-1 text-ink";

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

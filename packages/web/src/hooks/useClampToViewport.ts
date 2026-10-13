import { type RefObject, useLayoutEffect } from "react";

const EDGE_GAP_PX = 8;

/**
 * While `active`, narrows `ref`'s absolutely positioned element to fit the viewport and
 * shifts it left by as much as it would run past the right edge, never so far that its left
 * edge passes the left one. Measured against `clientWidth`, which leaves out a scrollbar.
 * Re-measured whenever the element or the viewport resizes, so content that loads after
 * opening still lands inside. jsdom has no ResizeObserver and lays nothing out, so there
 * the element keeps its stylesheet placement.
 */
export function useClampToViewport(ref: RefObject<HTMLElement | null>, active: boolean) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!active || !element || typeof ResizeObserver !== "function") return;
    function place() {
      if (!element) return;
      const viewport = document.documentElement.clientWidth;
      const room = viewport - 2 * EDGE_GAP_PX;
      element.style.maxWidth = "";
      if (element.offsetWidth > room) element.style.maxWidth = `${room}px`;
      const start = element.offsetParent?.getBoundingClientRect().left ?? 0;
      const overflow = start + element.offsetWidth - (viewport - EDGE_GAP_PX);
      const shift = Math.max(0, Math.min(overflow, start - EDGE_GAP_PX));
      element.style.left = shift > 0 ? `${-shift}px` : "";
    }
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    observer.observe(document.documentElement);
    return () => {
      observer.disconnect();
      element.style.left = "";
      element.style.maxWidth = "";
    };
  }, [ref, active]);
}

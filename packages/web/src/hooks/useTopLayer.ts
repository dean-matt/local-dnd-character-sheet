import { type RefObject, useLayoutEffect } from "react";

/**
 * Shows `ref`'s element in the top layer while `open`: above the page and any modal, and out
 * of their flow, so neither clips it nor grows to hold it. Set here rather than as a
 * `popover` prop: jsdom has no showPopover, and hides a `popover` it cannot show.
 */
export function useTopLayer(ref: RefObject<HTMLElement | null>, open: boolean) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!open || !element || typeof element.showPopover !== "function") return;
    element.setAttribute("popover", "manual");
    element.showPopover();
    // Taken out on close, not just hidden: a list that stayed in the top layer would draw
    // under any modal opened after it.
    return () => {
      element.hidePopover();
      element.removeAttribute("popover");
    };
  }, [ref, open]);
}

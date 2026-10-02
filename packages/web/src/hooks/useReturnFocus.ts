import { useEffect, useRef } from "react";

/**
 * A ref for the element that opened a dialog, focused again once `open` turns false. The
 * effect runs after the dialog unmounts, so the focus lands on an element no longer inert.
 */
export function useReturnFocus<T extends HTMLElement>(open: boolean) {
  const target = useRef<T>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !open) target.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return target;
}

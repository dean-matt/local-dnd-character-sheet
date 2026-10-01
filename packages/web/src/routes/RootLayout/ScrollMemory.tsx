import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";

const POSITIONS_KEY = "scroll-positions";
const SETTLE_MS = 50;
const READER_ACTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

function readPositions(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(POSITIONS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Puts a reader back where they were on each history entry they return to, and at the top
 * of each new one. React Router's `ScrollRestoration` restores on the render a navigation
 * commits, which for a page whose queries have left the cache is still its loading state,
 * so this waits until no query is fetching. Positions sit in `sessionStorage`, one number
 * per history entry, so a reload keeps them and the tab closing drops them. The map grows by
 * one number per entry visited and is never pruned, a ceiling a session's length sets.
 *
 * A component of its own, so the fetch count it watches re-renders nothing but itself.
 */
export function ScrollMemory() {
  const { key } = useLocation();
  const navigationType = useNavigationType();
  const queryClient = useQueryClient();
  const fetching = useIsFetching();
  const restored = useRef<string | undefined>(undefined);
  const positions = useRef<Record<string, number>>(readPositions());
  const target = useRef<number | undefined>(undefined);

  useEffect(() => {
    history.scrollRestoration = "manual";
    const persist = () => {
      try {
        sessionStorage.setItem(POSITIONS_KEY, JSON.stringify(positions.current));
      } catch {}
    };
    window.addEventListener("pagehide", persist);
    return () => window.removeEventListener("pagehide", persist);
  }, []);

  // A layout effect, so the listener moves to the new entry inside the commit that swaps
  // the page: the scroll the browser fires when a shorter page clamps `scrollY` then
  // lands on the new entry rather than overwriting the one being left.
  //
  // The position to restore is read once, before `save` listens, and `save` waits until the
  // entry is restored or the reader claims it: the clamp on a return lands on this entry,
  // and it would otherwise replace the position being returned to.
  useLayoutEffect(() => {
    target.current = navigationType === "POP" ? positions.current[key] : undefined;
    const save = () => {
      if (restored.current === key) positions.current[key] = window.scrollY;
    };
    const claim = () => {
      restored.current = key;
    };
    window.addEventListener("scroll", save, { passive: true });
    for (const event of READER_ACTS) window.addEventListener(event, claim, { passive: true });
    return () => {
      window.removeEventListener("scroll", save);
      for (const event of READER_ACTS) window.removeEventListener(event, claim);
      try {
        sessionStorage.setItem(POSITIONS_KEY, JSON.stringify(positions.current));
      } catch {}
    };
  }, [key, navigationType]);

  // A new entry goes to the top at once. A page mounts its next query a commit after the
  // last settles, so a return waits for a quiet spell rather than the first zero, and a
  // reader who scrolls or presses a key first keeps their own position. The ceiling is a
  // query starting more than `SETTLE_MS` after the last settles, which lands after the
  // restore. Past that, restore from each page once its own data is in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `fetching` only re-runs this, cancelling a restore a new fetch overtakes
  useEffect(() => {
    if (restored.current === key) return;
    const saved = target.current;
    if (saved === undefined) {
      restored.current = key;
      window.scrollTo(0, 0);
      return;
    }
    const timer = setTimeout(() => {
      if (restored.current === key || queryClient.isFetching() > 0) return;
      restored.current = key;
      window.scrollTo(0, saved);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [key, navigationType, fetching, queryClient]);

  return null;
}

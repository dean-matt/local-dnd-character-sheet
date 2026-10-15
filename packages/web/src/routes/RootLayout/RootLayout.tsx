import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { SaveToasts } from "../../components/SaveToasts.tsx";
import { CatalogOutOfDateBanner } from "./CatalogOutOfDateBanner.tsx";
import { ScrollMemory } from "./ScrollMemory.tsx";
import { TopBar } from "./TopBar/TopBar.tsx";

/**
 * The router moves the browser's focus nowhere on its own, so a screen reader keeps
 * reading whatever the previous page left focused. Moving focus to `main` on every
 * navigation after the first restores the landmark a full page load would have given
 * for free; the first is skipped so mounting the app doesn't steal focus from the
 * browser chrome. A navigation made from inside an open dialog, such as Manage pages
 * opening a page it just added, leaves focus in the dialog that stays over the new page.
 * `preventScroll` leaves the scroll position to `ScrollMemory`.
 */
export function RootLayout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const mounted = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-runs on the path alone, not on every render
  useEffect(() => {
    const inDialog = document.activeElement?.closest("dialog[open]");
    if (mounted.current && !inDialog) mainRef.current?.focus({ preventScroll: true });
    mounted.current = true;
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-card focus:bg-surface focus:px-3 focus:py-2 focus:text-row"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-30 h-topbar shrink-0 print:hidden">
        <TopBar />
      </header>
      <CatalogOutOfDateBanner />
      <main id="main-content" ref={mainRef} tabIndex={-1} className="print:p-0">
        <Outlet />
      </main>
      <ScrollMemory />
      <SaveToasts />
    </div>
  );
}

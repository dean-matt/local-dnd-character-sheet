import { useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { ThemeToggle } from "../ThemeToggle.tsx";

/**
 * The router moves the browser's focus nowhere on its own, so a screen reader keeps
 * reading whatever the previous page left focused. Moving focus to `main` on every
 * navigation after the first restores the landmark a full page load would have given
 * for free; the first is skipped so mounting the app doesn't steal focus from the
 * browser chrome.
 */
export function RootLayout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const mounted = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-runs on the path alone, not on every render
  useEffect(() => {
    if (mounted.current) mainRef.current?.focus();
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
      <header className="flex flex-col gap-2 border-border border-b p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Link to="/" className="font-semibold text-row uppercase tracking-wide">
          D&amp;D Character Sheet
        </Link>
        <ThemeToggle />
      </header>
      <main id="main-content" ref={mainRef} tabIndex={-1} className="p-4 sm:p-8 print:p-0">
        <Outlet />
      </main>
    </div>
  );
}

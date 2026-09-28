import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useCharacters } from "../hooks/useCharacters.ts";
import { avatarColor } from "../lib/avatarColor.ts";
import { ThemeToggle } from "../ThemeToggle.tsx";

/**
 * Gear icon for the Settings button — svg inline so it can inherit stroke from the button's
 * color, keeping the icon consistent with the button label without a separate token.
 */
function GearIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1h.1a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  );
}

function ChevronDown({ rotated }: { rotated: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
      style={{ transform: rotated ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

type Menu = "character" | "settings" | null;

/**
 * Application top bar: the "Local D&D" wordmark, a Character switcher menu, and a
 * Settings button with the theme control.
 */
export function TopBar() {
  const characters = useCharacters();
  const [open, setOpen] = useState<Menu>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toggle = (menu: Menu) => setOpen((prev) => (prev === menu ? null : menu));

  // Close the open menu when focus leaves the top bar or when Escape is pressed.
  useEffect(() => {
    if (!open) return;
    const onFocusIn = (e: FocusEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node | null)) {
        setOpen(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center gap-1.5 border-b border-border bg-surface px-6"
    >
      <span className="mr-3.5 shrink-0 text-lg font-bold text-accent">Local D&D</span>

      {/* Character menu */}
      <div className="relative shrink-0">
        <button
          type="button"
          aria-expanded={open === "character"}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(null);
          }}
          onClick={() => toggle("character")}
          className="flex items-center gap-1.5 rounded-control border-0 bg-transparent px-3 py-2 text-sm font-semibold text-ink hover:bg-subtle"
        >
          Character
          <ChevronDown rotated={open === "character"} />
        </button>

        {open === "character" && (
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-only backdrop; Escape and Tab handled on the container */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: pointer-only backdrop; Escape and Tab handled on the container */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(null)} />
            <div className="absolute left-0 top-full z-50 mt-2 w-60 rounded-card border border-border bg-surface p-2 shadow-popover">
              <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
                Your Characters
              </p>
              {characters.data?.map((c) => (
                <Link
                  key={c.id}
                  to={`/characters/${c.id}`}
                  onClick={() => setOpen(null)}
                  className="flex items-center gap-2.5 rounded-control px-2.5 py-2 text-ink hover:bg-subtle"
                >
                  <span
                    className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                    style={{ background: avatarColor(c.id) }}
                    aria-hidden
                  >
                    {c.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {c.raceSummary} {c.classSummary} · Lvl {c.level}
                    </span>
                  </span>
                </Link>
              ))}
              <Link
                to="/"
                onClick={() => setOpen(null)}
                className="mt-1 block rounded-control border-t border-border px-2.5 py-2 text-sm font-semibold text-ink hover:bg-subtle"
              >
                See all characters →
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Settings */}
      <div className="relative ml-auto shrink-0">
        <button
          type="button"
          aria-expanded={open === "settings"}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(null);
          }}
          onClick={() => toggle("settings")}
          className="flex items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-subtle"
        >
          Settings
          <GearIcon />
        </button>

        {open === "settings" && (
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-only backdrop; Escape and Tab handled on the container */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: pointer-only backdrop; Escape and Tab handled on the container */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(null)} />
            <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-card border border-border bg-surface p-3 shadow-popover">
              <ThemeToggle />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

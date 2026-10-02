import { ChevronDown, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useMatch } from "react-router";
import { useCharacters } from "../../../hooks/useCharacters.ts";
import { avatarColor } from "../../../lib/avatarColor.ts";

const trigger = "flex items-center gap-1.5 rounded-sm border-0 px-2.5 py-1.5 text-sm";
const current = "font-bold text-accent-text";
const elsewhere = "font-medium text-secondary";

export function TopBar() {
  const characters = useCharacters();
  const [open, setOpen] = useState(false);
  const inCharacters = useMatch({ path: "/characters", end: false }) !== null;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onFocusIn = (e: FocusEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node | null)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
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
      <Link to="/" className="mr-3.5 shrink-0 rounded-control text-lg font-bold text-accent-text">
        Local D&D
      </Link>

      <div className="relative shrink-0">
        <button
          type="button"
          aria-expanded={open}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          onClick={() => setOpen((prev) => !prev)}
          className={`${trigger} ${inCharacters ? current : elsewhere} ${open ? "bg-subtle" : "bg-transparent hover:bg-subtle"}`}
        >
          Character
          <ChevronDown
            size={12}
            strokeWidth={2.5}
            className={inCharacters ? undefined : "text-muted"}
            style={{
              transform: open ? "rotate(180deg)" : undefined,
              transition: "transform 0.15s",
            }}
          />
        </button>

        {open && (
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-only backdrop; Escape and Tab handled on the container */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: pointer-only backdrop; Escape and Tab handled on the container */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full z-50 mt-2 w-60 rounded-xl border border-border bg-surface p-2 shadow-popover">
              <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-label text-muted">
                Your Characters
              </p>
              {characters.data?.map((c) => (
                <NavLink
                  key={c.id}
                  to={`/characters/${c.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-ink hover:bg-subtle"
                >
                  <span
                    className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                    style={{ background: avatarColor(c.id) }}
                    aria-hidden
                  >
                    {c.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-body font-medium">{c.name}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {c.raceSummary} {c.classSummary} • Lvl {c.level}
                    </span>
                  </span>
                </NavLink>
              ))}
              <NavLink
                to="/characters"
                end
                onClick={() => setOpen(false)}
                className="mt-1 block rounded-lg border-t border-border px-2.5 py-2 text-body font-semibold text-ink hover:bg-subtle"
              >
                See all characters →
              </NavLink>
            </div>
          </>
        )}
      </div>

      <NavLink
        to="/settings"
        className={({ isActive }) =>
          `ml-auto shrink-0 ${trigger} ${isActive ? current : elsewhere} hover:bg-subtle`
        }
      >
        {({ isActive }) => (
          <>
            Settings
            <Settings size={16} className={isActive ? undefined : "text-muted"} />
          </>
        )}
      </NavLink>
    </div>
  );
}

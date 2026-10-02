import { ChevronDown, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useMatch } from "react-router";
import { useCharacters } from "../../../hooks/useCharacters.ts";
import { CharacterAvatar } from "./CharacterAvatar.tsx";
import { GlobalSearch } from "./GlobalSearch/GlobalSearch.tsx";
import { MechanicsMenu } from "./MechanicsMenu.tsx";

const trigger = "flex items-center gap-1.5 rounded-sm border-0 px-2.5 py-1.5 text-sm";
const current = "font-bold text-accent-text";
const elsewhere = "font-medium text-secondary";

type Menu = "character" | "mechanics";

export function TopBar() {
  const characters = useCharacters();
  const [openMenu, setOpenMenu] = useState<Menu | null>(null);
  const open = openMenu === "character";
  const close = () => setOpenMenu(null);
  const toggle = (menu: Menu) => setOpenMenu((prev) => (prev === menu ? null : menu));
  const inCharacters = useMatch({ path: "/characters", end: false }) !== null;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openMenu === null) return;
    const onFocusIn = (e: FocusEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node | null)) {
        setOpenMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center gap-1.5 border-b border-border bg-surface px-6"
    >
      {openMenu !== null && (
        // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only backdrop; Escape and Tab handled on the container
        // biome-ignore lint/a11y/useKeyWithClickEvents: pointer-only backdrop; Escape and Tab handled on the container
        <div className="fixed inset-0 z-40" onClick={close} />
      )}
      <Link to="/" className="mr-3.5 shrink-0 rounded-control text-lg font-bold text-accent-text">
        Local D&D
      </Link>

      <div className="relative shrink-0">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => toggle("character")}
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
          <div className="absolute left-0 top-full z-50 mt-2 w-60 rounded-xl border border-border bg-surface p-2 shadow-popover">
            <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-label text-muted">
              Your Characters
            </p>
            {characters.data?.map((c) => (
              <NavLink
                key={c.id}
                to={`/characters/${c.id}`}
                onClick={close}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-ink hover:bg-subtle"
              >
                <CharacterAvatar id={c.id} name={c.name} />
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
              onClick={close}
              className="mt-1 block rounded-lg border-t border-border px-2.5 py-2 text-body font-semibold text-ink hover:bg-subtle"
            >
              See all characters →
            </NavLink>
          </div>
        )}
      </div>

      <MechanicsMenu
        open={openMenu === "mechanics"}
        onToggle={() => toggle("mechanics")}
        onClose={close}
        triggerClassName={trigger}
      />

      <GlobalSearch onOpen={close} />

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

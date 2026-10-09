import { ChevronDown } from "lucide-react";
import { Link, useMatch } from "react-router";
import { useSearchTypes } from "../../../hooks/useSearchTypes.ts";
import { isCatalogOutOfDate } from "../../../lib/api.ts";
import { MECHANICS_ENTRIES, mechanicsHref } from "../../../lib/mechanicsEntries.ts";
import { MenuDivider } from "./MenuDivider.tsx";
import { CURRENT, ELSEWHERE, TRIGGER } from "./topBarTrigger.ts";

export interface MechanicsMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

const entryLink = "rounded-lg px-2.5 py-2 text-body font-medium text-ink hover:bg-subtle";

/**
 * The top bar's Mechanics menu: a hand-picked list of the catalog's kinds, each opening the
 * search page filtered to it, then "All types…" opening it unfiltered. Three columns hold
 * the whole list in an ordinary window; a window shorter than the menu scrolls it.
 */
export function MechanicsMenu({ open, onToggle, onClose }: MechanicsMenuProps) {
  const types = useSearchTypes();
  const here = useMatch("/search") !== null;
  const searchable = new Set(types.data ?? []);
  const entries = MECHANICS_ENTRIES.filter(({ type }) => searchable.has(type));

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`${TRIGGER} ${here ? CURRENT : ELSEWHERE} ${open ? "bg-subtle" : "bg-transparent hover:bg-subtle"}`}
      >
        Mechanics
        <ChevronDown
          size={12}
          strokeWidth={2.5}
          className={here ? undefined : "text-muted"}
          style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
        />
      </button>
      {open && (
        <>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-only backdrop; Escape and Tab handled on the container */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: pointer-only backdrop; Escape and Tab handled on the container */}
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="absolute left-0 top-full z-50 mt-2 grid max-h-[calc(100dvh-var(--spacing-topbar)-1rem)] w-160 grid-cols-3 gap-0.5 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-popover">
            {types.isError && !isCatalogOutOfDate(types.error) && (
              <p className="col-span-3 px-2.5 py-2 text-body text-error">
                The catalog's types did not load.
              </p>
            )}
            {entries.map((entry) => (
              <Link
                key={entry.label}
                to={mechanicsHref(entry)}
                onClick={onClose}
                className={entryLink}
              >
                {entry.label}
              </Link>
            ))}
            <MenuDivider className="col-span-3" />
            <Link to="/search" onClick={onClose} className={`${entryLink} col-span-3`}>
              All types…
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

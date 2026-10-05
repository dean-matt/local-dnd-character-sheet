import { ChevronDown } from "lucide-react";
import { Link, useMatch } from "react-router";
import { useSearchTypes } from "../../../hooks/useSearchTypes.ts";
import { ARMOR_KINDS, WEAPON_KINDS } from "../../../lib/itemKind.ts";
import { MenuDivider } from "./MenuDivider.tsx";
import { CURRENT, ELSEWHERE, TRIGGER } from "./topBarTrigger.ts";

export interface MechanicsMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/**
 * The menu's entries, alphabetical, each with the search it opens. Weapons and Armor narrow
 * items to kinds; the rest name a type. An entry shows only once `/search/types` returns its
 * type, so a type that becomes searchable joins the menu with no change here.
 */
const ENTRIES: { label: string; params: Record<string, string> }[] = [
  { label: "Actions", params: { type: "action" } },
  { label: "Armor", params: { type: "item", kind: ARMOR_KINDS.join(",") } },
  { label: "Backgrounds", params: { type: "background" } },
  { label: "Classes", params: { type: "class" } },
  { label: "Conditions", params: { type: "condition" } },
  { label: "Deities", params: { type: "deity" } },
  { label: "Diseases", params: { type: "disease" } },
  { label: "Feats", params: { type: "feat" } },
  { label: "Items", params: { type: "item" } },
  { label: "Languages", params: { type: "language" } },
  { label: "Monsters", params: { type: "monster" } },
  { label: "Optional Features", params: { type: "optfeature" } },
  { label: "Races", params: { type: "race" } },
  { label: "Senses", params: { type: "sense" } },
  { label: "Skills", params: { type: "skill" } },
  { label: "Spells", params: { type: "spell" } },
  { label: "Subclasses", params: { type: "subclass" } },
  { label: "Tables", params: { type: "table" } },
  { label: "Variant Rules", params: { type: "variantrule" } },
  { label: "Vehicles", params: { type: "vehicle" } },
  { label: "Weapons", params: { type: "item", kind: WEAPON_KINDS.join(",") } },
];

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
  const entries = ENTRIES.filter(({ params }) => searchable.has(params.type ?? ""));

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
            {types.isError && (
              <p className="col-span-3 px-2.5 py-2 text-body text-muted">
                The catalog's types did not load.
              </p>
            )}
            {entries.map(({ label, params }) => (
              <Link
                key={label}
                to={`/search?${new URLSearchParams(params)}`}
                onClick={onClose}
                className={entryLink}
              >
                {label}
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

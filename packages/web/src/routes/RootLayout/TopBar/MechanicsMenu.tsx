import { ChevronDown } from "lucide-react";
import { Link, useMatch } from "react-router";
import { useSearchTypes } from "../../../hooks/useSearchTypes.ts";
import { ARMOR_KINDS, WEAPON_KINDS } from "../../../lib/itemKind.ts";
import { searchHitTypePlural } from "../../../lib/searchHits.ts";
import { CURRENT, ELSEWHERE, TRIGGER } from "./topBarTrigger.ts";

export interface MechanicsMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/**
 * The top bar's Mechanics menu: each kind of catalog row, opening the search page filtered to
 * it, and Weapons and Armor, opening it filtered to items of those kinds.
 */
export function MechanicsMenu({ open, onToggle, onClose }: MechanicsMenuProps) {
  const types = useSearchTypes();
  const here = useMatch("/search") !== null;
  const typeList = types.data ?? [];
  const entries = [
    ...typeList.map((type) => ({ label: searchHitTypePlural(type), params: { type } })),
    ...(typeList.includes("item")
      ? [
          { label: "Weapons", params: { type: "item", kind: WEAPON_KINDS.join(",") } },
          { label: "Armor", params: { type: "item", kind: ARMOR_KINDS.join(",") } },
        ]
      : []),
  ].sort((a, b) => a.label.localeCompare(b.label));

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
          <div className="absolute left-0 top-full z-50 mt-2 grid max-h-[70vh] w-100 grid-cols-2 gap-0.5 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-popover">
            {types.isError && (
              <p className="col-span-2 px-2.5 py-2 text-body text-muted">
                The catalog's types did not load.
              </p>
            )}
            {entries.map(({ label, params }) => (
              <Link
                key={label}
                to={`/search?${new URLSearchParams(params)}`}
                onClick={onClose}
                className="rounded-lg px-2.5 py-2 text-body font-medium text-ink hover:bg-subtle"
              >
                {label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

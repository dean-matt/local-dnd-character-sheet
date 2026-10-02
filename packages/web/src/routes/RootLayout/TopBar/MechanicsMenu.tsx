import { ChevronDown } from "lucide-react";
import { Link } from "react-router";
import { CATALOG_INDEXES } from "../../../lib/catalogIndexes.ts";

export interface MechanicsMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** The trigger's shape, shared with the bar's other menus. */
  triggerClassName: string;
}

/** The catalog types a reader can browse, each opening its index route. */
export function MechanicsMenu({ open, onToggle, onClose, triggerClassName }: MechanicsMenuProps) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`${triggerClassName} font-medium text-secondary ${open ? "bg-subtle" : "bg-transparent hover:bg-subtle"}`}
      >
        Mechanics
        <ChevronDown
          size={12}
          strokeWidth={2.5}
          className="text-muted"
          style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
        />
      </button>
      {open && (
        <ul className="absolute left-0 top-full z-50 mt-2 grid w-105 grid-cols-2 gap-x-2 gap-y-0.5 rounded-xl border border-border bg-surface p-2.5 shadow-popover">
          {CATALOG_INDEXES.map((index) => (
            <li key={index.collection}>
              <Link
                to={`/catalog/${index.collection}`}
                onClick={onClose}
                className="block rounded-md px-2.5 py-1.75 text-body text-ink hover:bg-subtle"
              >
                {index.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

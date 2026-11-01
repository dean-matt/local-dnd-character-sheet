import { ChevronDown, FlaskConical } from "lucide-react";
import { Link, useMatch } from "react-router";
import { LISTING_KINDS } from "../../../lib/homebrewListing.ts";
import { MenuDivider } from "./MenuDivider.tsx";
import { CURRENT, ELSEWHERE, TRIGGER } from "./topBarTrigger.ts";

export interface HomebrewMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

const entryLink = "block rounded-lg px-2.5 py-2 text-body font-medium text-ink hover:bg-subtle";

/** The top bar's Homebrew menu: each homebrew kind's page, then Recently deleted. */
export function HomebrewMenu({ open, onToggle, onClose }: HomebrewMenuProps) {
  const here = useMatch({ path: "/homebrew", end: false }) !== null;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`${TRIGGER} ${here ? CURRENT : ELSEWHERE} ${open ? "bg-subtle" : "bg-transparent hover:bg-subtle"}`}
      >
        <span className="max-sm:sr-only">Homebrew</span>
        <FlaskConical size={16} className={`sm:hidden ${here ? "" : "text-muted"}`} />
        <ChevronDown
          size={12}
          strokeWidth={2.5}
          className={`max-sm:hidden ${here ? "" : "text-muted"}`}
          style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
        />
      </button>
      {open && (
        <>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-only backdrop; Escape and Tab handled on the container */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: pointer-only backdrop; Escape and Tab handled on the container */}
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="absolute left-0 top-full z-50 mt-2 w-60 rounded-xl border border-border bg-surface p-2 shadow-popover">
            {Object.values(LISTING_KINDS).map((kind) => (
              <Link
                key={kind.collection}
                to={`/homebrew/${kind.collection}`}
                onClick={onClose}
                className={entryLink}
              >
                {kind.heading}
              </Link>
            ))}
            <MenuDivider />
            <Link to="/homebrew/deleted" onClick={onClose} className={entryLink}>
              Recently deleted
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

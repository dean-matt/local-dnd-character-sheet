import { Info } from "lucide-react";
import { useId, useState } from "react";
import { TOGGLE_PILL } from "../../../../../lib/chipStyles.ts";

/**
 * The Prepared pill of a spell the character cannot unprepare, beside an info icon that
 * says why. `source` names the feat, race or other row it was picked for; without one the
 * spell was granted. The icon is the only tab stop, and its tooltip stays in the DOM so a
 * screen reader reads it as the icon's description.
 */
export function AlwaysPrepared({ name, source }: { name: string; source: string | undefined }) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  return (
    <>
      <span className="relative inline-flex">
        <button
          type="button"
          aria-label={`Why ${name} is always prepared`}
          aria-describedby={tooltipId}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          className="flex text-muted"
        >
          <Info size={14} aria-hidden />
        </button>
        <span
          id={tooltipId}
          role="tooltip"
          hidden={!open}
          className="absolute top-full right-0 z-10 mt-1 w-max max-w-xs rounded-card border border-border bg-surface p-2 text-ink text-row shadow-popover"
        >
          {`Always prepared: ${source ?? "this spell is granted"}. It does not count against the prepared limit.`}
        </span>
      </span>
      <span className={`${TOGGLE_PILL} border-accent bg-accent text-white`}>Prepared</span>
    </>
  );
}

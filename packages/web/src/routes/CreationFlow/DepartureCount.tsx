import { TriangleAlert } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { Departure } from "./departures.ts";

/** The count's button and the list it opens above the footer, which positions it. */
export function DepartureCount({ departures }: { departures: Departure[] }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape and focusout bubbling from the button and the list.
    <div
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        setOpen(false);
        button.current?.focus();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-control px-3 py-2 font-semibold text-accent-text text-body hover:bg-subtle"
      >
        <TriangleAlert aria-hidden="true" size={16} className="shrink-0" />
        {departures.length} off the rules
      </button>
      {open && (
        // Focusable so a click inside keeps focus within, rather than closing it as focusout.
        <section
          id={id}
          tabIndex={-1}
          aria-labelledby={`${id}-heading`}
          className="absolute right-gutter bottom-full left-gutter mb-2 rounded-card border border-border bg-surface p-3.5 shadow-popover outline-none sm:left-auto sm:w-96"
        >
          <h2
            id={`${id}-heading`}
            className="font-semibold text-label text-muted uppercase tracking-label"
          >
            Off the rules
          </h2>
          <p className="mt-1 text-muted text-row">The sheet notes each of these.</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-body">
            {departures.map((departure) => (
              <li key={`${departure.field}|${departure.note}`}>{departure.note}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

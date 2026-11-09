import { ListFilter } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";
import { CountBadge } from "../CountBadge.tsx";

/**
 * A card's Filter button and the popover of facets it opens, for a card header's `aside`.
 * `active` is how many facets narrow the card, shown as a badge; Reset clears them through
 * `onReset`. The popover stays in the DOM beside the button, so Tab runs button, facets,
 * Reset. Escape, or focus leaving, closes it, and Escape returns focus to the button. Escape inside a facet's own open list closes that list first.
 */
export function FilterButton({
  label,
  active,
  onReset,
  children,
}: {
  /** What the card holds, such as "Weapons", naming the button and the popover. */
  label: string;
  active: number;
  onReset: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !open || event.defaultPrevented) return;
    event.preventDefault();
    setOpen(false);
    button.current?.focus();
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape and focusout bubbling from the button and the popover.
    <span
      className="relative inline-block normal-case tracking-normal"
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={active > 0 ? `Filter ${label} (${active} active)` : `Filter ${label}`}
        onClick={() => setOpen(!open)}
        className="relative flex cursor-pointer items-center gap-0.5 rounded-control p-1 font-semibold text-accent-text hover:bg-subtle"
      >
        <ListFilter aria-hidden="true" size={12} />
        Filter
        <CountBadge count={active} className="-top-1 -right-1" />
      </button>
      {open && (
        // biome-ignore lint/a11y/useSemanticElements: a popover of controls, not a form group.
        <div
          id={id}
          role="group"
          aria-label={`${label} filter`}
          tabIndex={-1}
          className="absolute top-full right-0 z-10 mt-1 flex w-64 max-w-[80vw] flex-col gap-2 rounded-card border border-border bg-surface p-2.5 text-ink text-row shadow-popover"
        >
          {children}
          <button
            type="button"
            onClick={onReset}
            className="self-end rounded-control px-2 py-0.5 font-semibold text-accent-text hover:bg-subtle"
          >
            Reset
          </button>
        </div>
      )}
    </span>
  );
}

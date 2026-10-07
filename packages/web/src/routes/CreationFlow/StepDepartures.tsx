import type { CharacterDefinition } from "@dnd/character";
import { TriangleAlert } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useWatch } from "react-hook-form";
import { type CreationStep, stepOf } from "./creationSteps.ts";

type Departure = CharacterDefinition["departures"][number];

/**
 * The footer's count of what this step's values depart from the rules in, which opens the
 * notes the sheet will carry, so an escape taken low on a long step shows without scrolling.
 * The list opens above the footer, which positions it.
 */
export function StepDepartures({ step }: { step: CreationStep }) {
  const departures: Departure[] | undefined = useWatch<CharacterDefinition, "departures">({
    name: "departures",
  });
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const mine = (departures ?? []).filter((departure) => stepOf(departure.field) === step);
  if (mine.length === 0) return null;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape bubbling from the button and the list.
    <div
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        setOpen(false);
        button.current?.focus();
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
        {mine.length} off the rules
      </button>
      {open && (
        <section
          id={id}
          aria-labelledby={`${id}-heading`}
          className="absolute right-gutter bottom-full left-gutter mb-2 rounded-card border border-border bg-surface p-3.5 shadow-popover sm:left-auto sm:w-96"
        >
          <h2
            id={`${id}-heading`}
            className="font-semibold text-label text-muted uppercase tracking-label"
          >
            Off the rules
          </h2>
          <p className="mt-1 text-muted text-row">The sheet notes each of these.</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-body">
            {mine.map((departure) => (
              <li key={`${departure.field}|${departure.note}`}>{departure.note}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

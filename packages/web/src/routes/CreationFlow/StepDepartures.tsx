import type { CharacterDefinition } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { type CreationStep, stepOf } from "./creationSteps.ts";

type Departure = CharacterDefinition["departures"][number];

/**
 * What this step's values depart from the rules in, as the sheet will note them, so taking
 * an escape is visible where it was taken rather than discovered after Finish.
 */
export function StepDepartures({ step }: { step: CreationStep }) {
  const departures: Departure[] | undefined = useWatch<CharacterDefinition, "departures">({
    name: "departures",
  });
  const mine = (departures ?? []).filter((departure) => stepOf(departure.field) === step);
  if (mine.length === 0) return null;
  return (
    <section
      aria-labelledby="step-departures"
      className="rounded-card border border-border bg-surface p-3.5"
    >
      <h2
        id="step-departures"
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
  );
}

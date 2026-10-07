import type { CharacterDefinition } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { type CreationStep, stepOf } from "./creationSteps.ts";
import { DepartureCount } from "./DepartureCount.tsx";
import type { Departure } from "./departures.ts";

/**
 * The footer's count of what this step's values depart from the rules in, which opens the
 * notes the sheet will carry, so an escape taken low on a long step shows without scrolling.
 * The flow keys it by step, so a list opened on one step starts closed on the next.
 */
export function StepDepartures({ step }: { step: CreationStep }) {
  const departures: Departure[] | undefined = useWatch<CharacterDefinition, "departures">({
    name: "departures",
  });
  const mine = (departures ?? []).filter((departure) => stepOf(departure.field) === step);
  // Unmounting on an empty count drops the open state, so the next departure arrives closed.
  return mine.length === 0 ? null : <DepartureCount departures={mine} />;
}

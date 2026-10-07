import type { CharacterDefinition } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { CHIP } from "../../lib/chipStyles.ts";
import type { Departure } from "./departures.ts";

/**
 * Each note `departures` holds for `field`, or for every field it matches, tagged and
 * spelled out where the player set the value it departs in.
 */
export function DepartureMark({
  field,
  className = "",
}: {
  field: string | ((field: string) => boolean);
  className?: string;
}) {
  const departures: Departure[] | undefined = useWatch<CharacterDefinition, "departures">({
    name: "departures",
  });
  const mine = (departures ?? []).filter((departure) =>
    typeof field === "string" ? departure.field === field : field(departure.field),
  );
  if (mine.length === 0) return null;
  return (
    <ul className={`flex flex-col gap-1.5 ${className}`}>
      {mine.map((departure) => (
        <li
          key={`${departure.field}|${departure.note}`}
          className="flex flex-col items-start gap-0.5"
        >
          <span className={`${CHIP} border-accent-text text-accent-text uppercase`}>
            Off the rules
          </span>
          <span className="text-row text-secondary">{departure.note}</span>
        </li>
      ))}
    </ul>
  );
}

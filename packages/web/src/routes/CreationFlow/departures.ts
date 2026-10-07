import type { CharacterDefinition } from "@dnd/character";

type Departures = CharacterDefinition["departures"];

export type Departure = Departures[number];

/** Where `departures` notes a race the catalog lacks. */
export const RACE_FIELD = "race";

/** Where `departures` notes a homebrew class typed past the picker. */
export const CLASS_FIELD = "levels";

/** `departures` with `field`'s entry replaced by `note`, or dropped where `note` is absent. */
export function withDeparture(
  departures: Departures | undefined,
  field: string,
  note?: string,
): Departures {
  const others = (departures ?? []).filter((departure) => departure.field !== field);
  return note === undefined ? others : [...others, { field, note }];
}

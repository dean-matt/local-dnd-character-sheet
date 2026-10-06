import type { CharacterDefinition } from "@dnd/character";

type Departures = CharacterDefinition["departures"];

/** `departures` with `field`'s entry replaced by `note`, or dropped where `note` is absent. */
export function withDeparture(
  departures: Departures | undefined,
  field: string,
  note?: string,
): Departures {
  const others = (departures ?? []).filter((departure) => departure.field !== field);
  return note === undefined ? others : [...others, { field, note }];
}

/**
 * The picks a feat's own fields offer, read and written slot by slot: each offer's slots in
 * order, filled from the entry's stored picks the way the derived block reads them.
 */
import type { FeatOffer } from "@dnd/catalog";
import {
  type Ability,
  allocatePicks,
  type CharacterDefinition,
  type FeatPick,
} from "@dnd/character";

type FeatEntry = CharacterDefinition["feats"][number];
type Picks = NonNullable<FeatEntry["picks"]>;

/** A slot's value in a control: the field a pick lands in and its name, as one string. */
export const pickValue = ({ field, name }: FeatPick): string => `${field}|${name}`;

const fromValue = (value: string): FeatPick => {
  const at = value.indexOf("|");
  return { field: value.slice(0, at) as FeatPick["field"], name: value.slice(at + 1) };
};

/** Each offer's slots, `undefined` where nothing stored fills one. */
export function pickSlots(
  offers: readonly FeatOffer[],
  picks: FeatEntry["picks"],
): (FeatPick | undefined)[][] {
  const taken = allocatePicks(offers, picks);
  return offers.map((offer, at) =>
    Array.from({ length: offer.count }, (_, slot) => taken[at]?.[slot]),
  );
}

/**
 * The entry's picks with slot `slot` of offer `offer` set to `value`, every other slot
 * kept and anything stored that no offer takes dropped. `ability` stays as it was.
 */
export function withPick(
  offers: readonly FeatOffer[],
  picks: FeatEntry["picks"],
  offer: number,
  slot: number,
  value: string,
): Picks {
  const slots = pickSlots(offers, picks);
  const row = slots[offer];
  if (row) row[slot] = fromValue(value);
  const next: Picks = picks?.ability ? { ability: picks.ability } : {};
  for (const { field, name } of slots.flat().filter((pick) => pick !== undefined)) {
    if (field === "savingThrows") {
      next.savingThrows = [...(next.savingThrows ?? []), name as Ability];
    } else {
      next[field] = [...(next[field] ?? []), name];
    }
  }
  return next;
}

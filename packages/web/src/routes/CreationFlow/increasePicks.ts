import type { IncreaseAlternative } from "@dnd/catalog";
import type { Ability, CharacterDefinition } from "@dnd/character";

type Increase = CharacterDefinition["abilityIncreases"][number];
export type Grantor = Increase["grantedBy"];

/** Which alternative a grantor's increases take, and the ability each of its slots holds. */
export type Picks = { alternative: number; slots: (Ability | undefined)[] };

/**
 * How `stored`, one grantor's increases, reads against what its row offers: the first
 * alternative whose fixed increases are all there and whose slots account for the rest,
 * a slot left empty where nothing fills it. `undefined` where no alternative explains
 * them, as after the race changed.
 */
export function readPicks(
  alternatives: readonly IncreaseAlternative[],
  stored: readonly Increase[],
): Picks | undefined {
  for (const [index, alternative] of alternatives.entries()) {
    const rest = [...stored];
    const take = (match: (increase: Increase) => boolean) => {
      const at = rest.findIndex(match);
      return at === -1 ? undefined : rest.splice(at, 1)[0];
    };
    const fixed = Object.entries(alternative.fixed).every(([ability, amount]) =>
      take((increase) => increase.ability === ability && increase.amount === amount),
    );
    if (!fixed) continue;
    const slots: (Ability | undefined)[] = [];
    for (const slot of alternative.slots) {
      const filled = take(
        (increase) =>
          increase.amount === slot.amount &&
          slot.from.includes(increase.ability) &&
          !slots.includes(increase.ability),
      );
      slots.push(filled?.ability);
    }
    if (rest.length === 0) return { alternative: index, slots };
  }
  return undefined;
}

/** Whether `picks` fills every slot of the alternative it names. */
export const isComplete = (alternatives: readonly IncreaseAlternative[], picks?: Picks) =>
  picks !== undefined &&
  alternatives[picks.alternative] !== undefined &&
  picks.slots.every((slot) => slot !== undefined);

/** The increases `picks` stores for `grantedBy`: the alternative's fixed ones and each filled slot. */
export function increasesOf(
  alternatives: readonly IncreaseAlternative[],
  picks: Picks,
  grantedBy: Grantor,
): Increase[] {
  const alternative = alternatives[picks.alternative];
  if (alternative === undefined) return [];
  return [
    ...Object.entries(alternative.fixed).map(([ability, amount]) => ({
      ability: ability as Ability,
      amount,
      grantedBy,
    })),
    ...alternative.slots.flatMap((slot, index) => {
      const ability = picks.slots[index];
      return ability === undefined ? [] : [{ ability, amount: slot.amount, grantedBy }];
    }),
  ];
}

/** `increases` with `grantedBy`'s replaced by `mine`. */
export const withIncreases = (
  increases: readonly Increase[] | undefined,
  grantedBy: Grantor,
  mine: readonly Increase[],
): Increase[] => [
  ...(increases ?? []).filter((increase) => increase.grantedBy !== grantedBy),
  ...mine,
];

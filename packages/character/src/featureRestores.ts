/**
 * What a use of each held feature restores, read from its recorded `heal` and `tempHp`
 * mechanics, and the state a rolled amount leaves.
 */
import type { CharacterDerived } from "./characterDerived.ts";
import { type Mechanic, mechanicsOfKind } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import { healedState } from "./hitPointChange.ts";
import { refKey } from "./keys.ts";
import type { Ability } from "./refs.ts";
import type { CharacterState } from "./state.ts";
import { classLevels } from "./summaries.ts";

type Restore = CharacterDerived["featureRestores"][number];
type RestoreMechanic = Extract<Mechanic, { kind: "heal" | "tempHp" }>;

/**
 * What a restore reads off the sheet: a class table column's cell at the character's level, the
 * size of the dice a class pool holds, an ability's modifier, the proficiency bonus and the hit
 * point maximum the sheet shows.
 */
export type RestoreSheet = {
  column: (key: string) => string | undefined;
  die: (pool: string) => number | undefined;
  modifier: (ability: Ability) => number;
  proficiency: number;
  hitPointMaximum: number;
};

/** The dice and bonus `mechanic` restores at `levels` in its feature's class; null where the sheet prints no cell. */
function amount(
  { dice, bonus = [], times = 1, scales = [] }: RestoreMechanic,
  levels: number,
  sheet: RestoreSheet,
): Pick<Restore, "dice" | "bonus"> | null {
  const scaled = scales.filter((scale) => levels >= scale.level).at(-1);
  const rolled =
    typeof dice !== "object"
      ? (scaled?.dice ?? dice)
      : "pool" in dice
        ? `1d${sheet.die(dice.pool) ?? dice.die}`
        : sheet.column(dice.column);
  if (typeof dice === "object" && rolled === undefined) return null;
  const terms = scaled?.bonus === undefined ? bonus : [scaled.bonus];
  const sum = terms.reduce<number>((total, term) => {
    if (typeof term === "number") return total + term;
    if (term === "level") return total + levels;
    if (term === "proficiency") return total + sheet.proficiency;
    if (term === "halfMaximum") return total + Math.floor(sheet.hitPointMaximum / 2);
    return total + sheet.modifier(term);
  }, 0);
  return { dice: rolled ?? null, bonus: sum * times };
}

export function featureRestores(definition: HoldsFeatures, sheet: RestoreSheet): Restore[] {
  return heldFeatures(definition).flatMap((held) =>
    [...mechanicsOfKind(held.entry, "heal"), ...mechanicsOfKind(held.entry, "tempHp")].flatMap(
      (mechanic) => {
        const { levelsIn, per, most } = mechanic;
        const levels = levelsIn
          ? (classLevels(definition).find(
              (group) => !("homebrewId" in group.class) && refKey(group.class) === refKey(levelsIn),
            )?.level ?? 0)
          : held.levels;
        const restored = amount(mechanic, levels, sheet);
        if (!restored) return [];
        return [
          {
            feature: held.ref,
            kind: mechanic.kind,
            ...restored,
            others: mechanic.others === true,
            ...(per && {
              per: { unit: per, most: most ? Math.max(1, sheet.modifier(most)) : null },
            }),
          },
        ];
      },
    ),
  );
}

const NOTATION = /^(\d+)d(\d+)$/;

/** The dice and bonus of `restore` for `count` of what it lands per: slot levels or creatures; as it stands without a `per`. */
export function restoreFor(
  { dice, bonus, per }: Pick<Restore, "dice" | "bonus" | "per">,
  count: number,
): Pick<Restore, "dice" | "bonus"> {
  if (!per) return { dice, bonus };
  const parts = dice === null ? null : NOTATION.exec(dice);
  return { dice: parts ? `${Number(parts[1]) * count}d${parts[2]}` : null, bonus: bonus * count };
}

/**
 * The state after `restore` lands for `total`, and the amount, at least 1: hit points healed by `healedState`,
 * or temporary hit points kept at the higher of the old and the new. A restore on another
 * creature leaves the state as it was.
 */
export function restoredState(
  derived: Pick<CharacterDerived, "hitPointMaximum">,
  state: CharacterState,
  restore: Pick<Restore, "kind" | "others">,
  total: number,
): { state: CharacterState; amount: number } {
  const amount = Math.max(1, total);
  if (restore.others) return { state, amount };
  if (restore.kind === "heal") return { state: healedState(derived, state, amount).state, amount };
  const temporary = Math.max(state.hitPoints.temporary, amount);
  return { state: { ...state, hitPoints: { ...state.hitPoints, temporary } }, amount };
}

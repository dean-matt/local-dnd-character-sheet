/**
 * What a use of each held feature restores, read from its recorded `heal` and `tempHp`
 * mechanics, and the state a rolled amount leaves.
 */
import type { CharacterDerived } from "./characterDerived.ts";
import { type Mechanic, mechanicsOfKind } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import { healedState } from "./hitPointChange.ts";
import type { Ability } from "./refs.ts";
import type { CharacterState } from "./state.ts";

type Restore = CharacterDerived["featureRestores"][number];
type RestoreMechanic = Extract<Mechanic, { kind: "heal" | "tempHp" }>;

/** What a restore reads off the sheet: a class table column's cell at the character's level, and an ability's modifier. */
export type RestoreSheet = {
  column: (key: string) => string | undefined;
  modifier: (ability: Ability) => number;
};

/** The dice and bonus `mechanic` restores at `levels` in its feature's class; null where the sheet prints no cell. */
function amount(
  { dice, bonus = [], times = 1, scales = [] }: RestoreMechanic,
  levels: number,
  sheet: RestoreSheet,
): Pick<Restore, "dice" | "bonus"> | null {
  const scaled = scales.filter((scale) => levels >= scale.level).at(-1);
  const rolled = typeof dice === "object" ? sheet.column(dice.column) : (scaled?.dice ?? dice);
  if (typeof dice === "object" && rolled === undefined) return null;
  const terms = scaled?.bonus === undefined ? bonus : [scaled.bonus];
  const sum = terms.reduce<number>((total, term) => {
    if (term === "level") return total + levels;
    return total + (typeof term === "number" ? term : sheet.modifier(term));
  }, 0);
  return { dice: rolled ?? null, bonus: sum * times };
}

export function featureRestores(definition: HoldsFeatures, sheet: RestoreSheet): Restore[] {
  return heldFeatures(definition).flatMap((held) =>
    [...mechanicsOfKind(held.entry, "heal"), ...mechanicsOfKind(held.entry, "tempHp")].flatMap(
      (mechanic) => {
        const restored = amount(mechanic, held.levels, sheet);
        if (!restored) return [];
        return [
          {
            feature: held.ref,
            kind: mechanic.kind,
            ...restored,
            others: mechanic.kind === "heal" && mechanic.others === true,
          },
        ];
      },
    ),
  );
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

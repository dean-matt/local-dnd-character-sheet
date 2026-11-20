/** What the turn economy mechanics of a character's held features add up to. */
import type { CharacterDerived } from "./characterDerived.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";

/**
 * Extra Attack never stacks, so the most attacks any held feature allows is the count; the
 * attacks a feature adds come on top. A mechanic held `while: "raging"` counts only while
 * `raging`, which is false in heavy armor. A count under a condition is named, not counted.
 */
export function featureTurn(definition: HoldsFeatures, raging: boolean): CharacterDerived["turn"] {
  const held = heldFeatures(definition).flatMap(({ ref, entry }) =>
    mechanicsOfKind(entry, "turn")
      .filter(({ while: during }) => during !== "raging" || raging)
      .map((turn) => ({ ref, turn })),
  );
  const always = held.filter(({ turn }) => !turn.option);
  const added = always.filter(({ turn }) => turn.more).length;
  const most = (pact: boolean) =>
    Math.max(1, ...always.map(({ turn }) => (Boolean(turn.pact) === pact && turn.attacks) || 1)) +
    added;
  const attacks = most(false);
  const pactAttacks = most(true);
  const bonusActions = new Map<string, string[]>();
  for (const { ref, turn } of held)
    for (const action of turn.bonusAction ?? [])
      bonusActions.set(action, [...(bonusActions.get(action) ?? []), ref.name]);
  return {
    attacks,
    pactAttacks: pactAttacks > attacks ? pactAttacks : null,
    conditionalAttacks: held.flatMap(({ ref, turn }) => {
      const count = turn.more ? attacks + 1 : turn.attacks;
      return turn.option && count && count > attacks
        ? [{ feature: ref.name, attacks: count, option: turn.option }]
        : [];
    }),
    addsAction: held.filter(({ turn }) => turn.action).map(({ ref }) => ref),
    bonusActions: [...bonusActions].map(([action, features]) => ({ action, features })),
  };
}

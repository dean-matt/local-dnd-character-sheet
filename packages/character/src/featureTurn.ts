/** What the turn economy mechanics of a character's held features add up to. */
import type { CharacterDerived } from "./characterDerived.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";

/** Extra Attack never stacks, so the most attacks any held feature allows is the count. */
export function featureTurn(definition: HoldsFeatures): CharacterDerived["turn"] {
  const held = heldFeatures(definition).flatMap(({ ref, entry }) =>
    mechanicsOfKind(entry, "turn").map((turn) => ({ ref, turn })),
  );
  const most = (pact: boolean) =>
    Math.max(1, ...held.map(({ turn }) => (Boolean(turn.pact) === pact && turn.attacks) || 1));
  const attacks = most(false);
  const pactAttacks = most(true);
  const bonusActions = new Map<string, string[]>();
  for (const { ref, turn } of held)
    for (const action of turn.bonusAction ?? [])
      bonusActions.set(action, [...(bonusActions.get(action) ?? []), ref.name]);
  return {
    attacks,
    pactAttacks: pactAttacks > attacks ? pactAttacks : null,
    addsAction: held.filter(({ turn }) => turn.action).map(({ ref }) => ref),
    bonusActions: [...bonusActions].map(([action, features]) => ({ action, features })),
  };
}

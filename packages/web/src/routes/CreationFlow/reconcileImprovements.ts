import {
  type CharacterDefinition,
  entryKey,
  improvementAt,
  improvementGrantor,
  withImprovement,
  withoutImprovement,
} from "@dnd/character";
import { raisesScores } from "../../lib/improvementChoice.ts";
import type { ImprovementGrant } from "../../lib/improvementGrants.ts";

type Held = Pick<CharacterDefinition, "feats" | "abilityIncreases">;

/**
 * `held` with each improvement's choice in step with `grants`: a choice at a level that
 * grants none goes, as does scores raised the other edition's way — a classic character
 * raises them without a feat, a 2024 one through `Ability Score Improvement` (XPHB) — and
 * a feat whose level now belongs to another class names that class.
 */
export function reconcileImprovements(
  held: Held,
  grants: readonly ImprovementGrant[],
  edition: CharacterDefinition["edition"],
): Held {
  const levels = new Set(
    [...held.feats, ...held.abilityIncreases].flatMap(({ level }) =>
      level === undefined ? [] : [level],
    ),
  );
  let next = held;
  for (const level of levels) {
    const improvement = improvementAt(next, level);
    if (improvement === undefined) continue;
    const grant = grants.find((each) => each.level === level);
    const fits =
      !raisesScores(improvement) || (edition === "one") === (improvement.feat !== undefined);
    const grantor = improvementGrantor(next, level);
    if (!grant || !fits) next = withoutImprovement(next, level);
    else if (grantor && entryKey(grantor) !== entryKey(grant.cls))
      next = withImprovement(next, level, grant.cls, improvement);
  }
  return next;
}

import {
  type CharacterDefinition,
  entryKey,
  IMPROVEMENT_FEAT,
  type Improvement,
  improvementAt,
  improvementGrantor,
  withImprovement,
  withoutImprovement,
} from "@dnd/character";
import { raisesScores } from "../../lib/improvementChoice.ts";
import type { ImprovementGrant } from "../../lib/improvementGrants.ts";

type Held = Pick<CharacterDefinition, "feats" | "abilityIncreases">;
type Edition = CharacterDefinition["edition"];

/**
 * Scores raised the edition's own way: a classic character raises them without a feat, a
 * 2024 one through `Ability Score Improvement` (XPHB). Converting keeps the increases, so
 * changing the edition back restores the choice.
 */
const raisedFor = (improvement: Improvement, edition: Edition): Improvement =>
  edition === "one"
    ? { feat: IMPROVEMENT_FEAT, increases: improvement.increases }
    : { increases: improvement.increases };

/**
 * `held` with each improvement's choice in step with `grants` for a character of `total`
 * levels: a choice at a level the classes still reach but grants none there goes, scores
 * raised the other edition's way are converted, and a feat whose level now belongs to
 * another class names that class. A feat a class grants at a level that holds no
 * improvement and no increase, such as a 2024 fighting style, is left alone while the
 * character still reaches its level.
 */
export function reconcileImprovements(
  held: Held,
  grants: readonly ImprovementGrant[],
  edition: Edition,
  total: number,
): Held {
  const granted = new Set(grants.map(({ level }) => level));
  const levels = new Set([
    ...held.abilityIncreases.flatMap(({ level }) => (level === undefined ? [] : [level])),
    ...held.feats.flatMap(({ level }) =>
      level !== undefined && (granted.has(level) || level > total) ? [level] : [],
    ),
  ]);
  let next = held;
  for (const level of levels) {
    const improvement = improvementAt(next, level);
    if (improvement === undefined) continue;
    const grant = grants.find((each) => each.level === level);
    if (!grant) {
      next = withoutImprovement(next, level);
      continue;
    }
    const fits =
      !raisesScores(improvement) || (edition === "one") === (improvement.feat !== undefined);
    const grantor = improvementGrantor(next, level);
    if (!fits) next = withImprovement(next, level, grant.cls, raisedFor(improvement, edition));
    else if (grantor && entryKey(grantor) !== entryKey(grant.cls))
      next = withImprovement(next, level, grant.cls, improvement);
  }
  return next;
}

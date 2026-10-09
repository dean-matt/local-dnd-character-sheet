import { type FeatRecord, featTermsSchema } from "@dnd/catalog";
import {
  ABILITIES,
  type Ability,
  abilityScore,
  type CharacterDefinition,
  type ContentRef,
  displayName,
  houseRule,
  IMPROVEMENT_FEAT,
  refKey,
  withoutImprovement,
} from "@dnd/character";
import type { ImprovementGrant } from "./improvementGrants.ts";

/**
 * The 2024 categories an improvement offers: general, origin and epic boon feats. A
 * fighting style needs the class feature that grants one, and a Dragonmark or a Dark
 * Gift an origin of its own.
 */
const OFFERED_CATEGORIES = ["G", "O", "EB"];

/** What a feat's prerequisites are read against, at the level the improvement arrives. */
export type Candidate = {
  edition: CharacterDefinition["edition"];
  /** Whether the character may take a feat at all, which a classic one may by house rule alone. */
  takesFeats: boolean;
  level: number;
  classNames: readonly string[];
  /**
   * The scores the character had reached at this level, which prerequisites read, and
   * every score bar this improvement's own increases, which an increase may not carry past
   * its cap. Both `undefined` while a base score is unset.
   */
  scores: Record<Ability, number> | undefined;
  totals: Record<Ability, number> | undefined;
  /** The feats the character holds from elsewhere, which a feat that does not repeat leaves out. */
  held: readonly ContentRef[];
};

/**
 * The feats `candidate` may take at an improvement, beside raising scores, which the
 * `Ability Score Improvement` (XPHB) feat stands for and so is not one of them. Scores
 * not yet set refuse no feat.
 */
export function improvementFeats(feats: readonly FeatRecord[], candidate: Candidate): FeatRecord[] {
  if (!candidate.takesFeats) return [];
  const held = new Set(candidate.held.map(refKey));
  return feats.filter((feat) => {
    if (refKey(feat) === refKey(IMPROVEMENT_FEAT)) return false;
    const { category, repeatable, prerequisites } = featTermsSchema.parse(feat.json);
    if (candidate.edition === "one" && !OFFERED_CATEGORIES.includes(category ?? "")) return false;
    if (!repeatable && held.has(refKey(feat))) return false;
    return (
      prerequisites.length === 0 ||
      prerequisites.some(
        ({ level, className, scores }) =>
          (level === undefined || level <= candidate.level) &&
          (className === undefined || candidate.classNames.includes(className)) &&
          (scores.length === 0 ||
            candidate.scores === undefined ||
            scores.some((minimums) =>
              Object.entries(minimums).every(
                ([ability, minimum]) => (candidate.scores?.[ability as Ability] ?? 0) >= minimum,
              ),
            )),
      )
    );
  });
}

/** The parts of a definition a candidate reads, whose scores a creation draft may hold unset. */
type Drafted = Pick<CharacterDefinition, "edition" | "levels" | "feats" | "abilityIncreases"> & {
  abilityScores: Partial<Record<Ability, number>> | undefined;
  houseRules: CharacterDefinition["houseRules"] | undefined;
};

/**
 * `definition` as a candidate for the feats at `grant`: its scores and classes as they
 * stood when that level was reached, its choice there set aside.
 */
export function candidateAt(definition: Drafted, grant: ImprovementGrant): Candidate {
  const { feats, abilityIncreases } = withoutImprovement(definition, grant.level);
  const base = definition.abilityScores ?? {};
  const set = ABILITIES.every((ability) => Number.isInteger(base[ability]));
  const scored = (increases: typeof abilityIncreases) =>
    set
      ? (Object.fromEntries(
          ABILITIES.map((ability) => [
            ability,
            abilityScore(
              { abilityScores: base as Record<Ability, number>, abilityIncreases: increases },
              ability,
            ),
          ]),
        ) as Record<Ability, number>)
      : undefined;
  return {
    edition: definition.edition,
    takesFeats:
      definition.edition === "one" ||
      houseRule({ houseRules: definition.houseRules ?? {} }, "feats"),
    level: grant.level,
    classNames: definition.levels.slice(0, grant.level).map((level) => displayName(level.class)),
    scores: scored(abilityIncreases.filter((increase) => (increase.level ?? 0) < grant.level)),
    totals: scored(abilityIncreases),
    held: feats.flatMap(({ ref }) => ("name" in ref ? [ref] : [])),
  };
}

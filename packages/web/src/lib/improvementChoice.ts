/**
 * What an improvement's choice offers to place once made: the increases raising scores
 * offers, or the ones the feat taken prints. The choice is made once it names a feat or
 * scores and fills every slot those offer.
 */
import { abilityIncreasesSchema, type FeatRecord, type IncreaseAlternative } from "@dnd/catalog";
import {
  ABILITIES,
  ABILITY_LABEL,
  type Ability,
  displayName,
  type EntryRef,
  IMPROVEMENT_CAP,
  IMPROVEMENT_FEAT,
  type Improvement,
  refKey,
} from "@dnd/character";
import { isComplete, readPicks } from "./increasePicks.ts";

/** +2 to one score or +1 to two, in both editions; the 2024 feat prints the same pair. */
const RAISE_ALTERNATIVES: IncreaseAlternative[] = [
  { fixed: {}, slots: [{ from: ABILITIES, amount: 2 }] },
  {
    fixed: {},
    slots: [
      { from: ABILITIES, amount: 1 },
      { from: ABILITIES, amount: 1 },
    ],
  },
];

/** Whether `improvement` raises scores rather than taking a feat of its own. */
export const raisesScores = (improvement: Improvement): boolean =>
  improvement.feat === undefined ||
  ("name" in improvement.feat && refKey(improvement.feat) === refKey(IMPROVEMENT_FEAT));

/** The catalog row `feat` names, `undefined` for a homebrew feat or one the catalog lacks. */
export const featRow = (feats: readonly FeatRecord[], feat: EntryRef): FeatRecord | undefined =>
  "name" in feat ? feats.find((row) => refKey(row) === refKey(feat)) : undefined;

type Totals = Record<Ability, number> | undefined;

/**
 * `alternative` with each fixed increase cut to what the cap leaves above `totals`, and
 * dropped where it leaves nothing: `Actor` (PHB) at 20 Charisma raises nothing.
 */
function capped(alternative: IncreaseAlternative, totals: Totals): IncreaseAlternative {
  if (totals === undefined) return alternative;
  const cap = alternative.max ?? IMPROVEMENT_CAP;
  const fixed = Object.entries(alternative.fixed).flatMap(([ability, amount = 0]) => {
    const room = amount > 0 ? Math.min(amount, cap - totals[ability as Ability]) : amount;
    return room === 0 || (amount > 0 && room < 0) ? [] : [[ability, room]];
  });
  return { ...alternative, fixed: Object.fromEntries(fixed) };
}

/**
 * The increases `improvement` offers to place, a feat's fixed ones held under the cap
 * above `totals`, the scores bar this improvement's own; a feat the catalog lacks offers
 * none.
 */
export function alternativesOf(
  improvement: Improvement,
  feats: readonly FeatRecord[],
  totals: Totals,
): IncreaseAlternative[] {
  if (raisesScores(improvement)) return RAISE_ALTERNATIVES;
  const row = improvement.feat && featRow(feats, improvement.feat);
  return row
    ? abilityIncreasesSchema.parse(row.json).map((alternative) => capped(alternative, totals))
    : [];
}

/** Whether `improvement` is made: chosen, with every increase it offers placed. */
export function isMade(
  improvement: Improvement | undefined,
  feats: readonly FeatRecord[],
  totals: Totals,
) {
  if (improvement === undefined) return false;
  const alternatives = alternativesOf(improvement, feats, totals);
  return (
    alternatives.length === 0 ||
    isComplete(alternatives, readPicks(alternatives, improvement.increases))
  );
}

/** What `improvement` took, in words: the feat, then each score it raised. */
export function improvementText(improvement: Improvement): string {
  const raised = improvement.increases
    .map(({ ability, amount }) => `+${amount} ${ABILITY_LABEL[ability]}`)
    .join(", ");
  if (raisesScores(improvement) || !improvement.feat) return raised;
  const feat = displayName(improvement.feat);
  return raised ? `${feat} (${raised})` : feat;
}

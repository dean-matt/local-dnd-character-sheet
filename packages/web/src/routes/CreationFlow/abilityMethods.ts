import { ABILITIES, ABILITY_LABEL, type Ability, type CharacterDefinition } from "@dnd/character";
import type { rollDice } from "@dnd/dice";

/** A draft's base scores, which hold only the abilities the player has set so far. */
export type Scores = Partial<Record<Ability, number>>;

export type Method = "standard" | "pointBuy" | "roll" | "custom";

type Dice = ReturnType<typeof rollDice>["dice"];

/** The method and the dice a roll showed, which the flow holds so leaving the step keeps them. */
export type AbilitiesMemory = { method: Method; rolls: Partial<Record<Ability, Dice>> };

export const METHODS: readonly { value: Method; label: string }[] = [
  { value: "standard", label: "Standard Array" },
  { value: "pointBuy", label: "Point Buy" },
  { value: "roll", label: "Roll" },
  { value: "custom", label: "Custom" },
];

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/** What each score costs under point buy, which both rulesets print alike. */
const POINT_COST: Readonly<Record<number, number>> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export const POINT_BUDGET = 27;
const POINT_MIN = 8;
const POINT_MAX = 15;

/** Where `departures` notes a method's scores, which one entry covers for all six. */
export const SCORES_FIELD = "abilityScores";

const NOTE = {
  standard: "Standard array:",
  pointBuy: "Point buy",
  custom: "Ability scores typed in",
} as const;

/** The points the set scores spend, a score past the table's ends costing what its nearer end does. */
export function pointsSpent(scores: Scores): number {
  return Object.values(scores).reduce((sum, score) => {
    const clamped = Math.min(Math.max(score, POINT_MIN), POINT_MAX);
    return sum + (POINT_COST[clamped] ?? 0);
  }, 0);
}

/** What `scores` under `method` depart from the rules in, or `undefined` where they keep to them. */
export function methodDeparture(method: Method, scores: Scores): string | undefined {
  const set = ABILITIES.flatMap((ability) => {
    const score = scores[ability];
    return score === undefined ? [] : [{ ability, score }];
  });
  if (method === "standard") {
    const twice = STANDARD_ARRAY.filter(
      (value) => set.filter(({ score }) => score === value).length > 1,
    );
    return twice.length === 0
      ? undefined
      : `${NOTE.standard} ${twice.join(", ")} assigned more than once.`;
  }
  if (method === "pointBuy") {
    const spent = pointsSpent(scores);
    const outside = set.filter(({ score }) => score < POINT_MIN || score > POINT_MAX);
    const notes = [
      ...(spent > POINT_BUDGET ? [`${spent} of ${POINT_BUDGET} points spent`] : []),
      ...(outside.length > 0
        ? [
            `${outside
              .map(({ ability, score }) => `${ABILITY_LABEL[ability]} is ${score}`)
              .join(", ")}, outside its ${POINT_MIN} to ${POINT_MAX}`,
          ]
        : []),
    ];
    return notes.length === 0 ? undefined : `${NOTE.pointBuy}: ${notes.join("; ")}.`;
  }
  if (method === "custom")
    return `${NOTE.custom} rather than set by the standard array, point buy or a roll.`;
  return undefined;
}

/**
 * The method a draft's scores were most likely set by, for a step opened on scores it did
 * not set this visit: the method its own departure names, else the standard array where
 * the scores are its values, point buy where they fit the budget, and a roll otherwise.
 */
export function methodOf(
  scores: Scores,
  departures: CharacterDefinition["departures"] | undefined,
): Method {
  const note = departures?.find((departure) => departure.field === SCORES_FIELD)?.note;
  const named = (Object.keys(NOTE) as (keyof typeof NOTE)[]).find((method) =>
    note?.startsWith(NOTE[method]),
  );
  if (named) return named;
  const values = Object.values(scores);
  const fromArray = (value: number, index: number) =>
    (STANDARD_ARRAY as readonly number[]).includes(value) && values.indexOf(value) === index;
  if (values.every(fromArray)) return "standard";
  if (methodDeparture("pointBuy", scores) === undefined) return "pointBuy";
  return "roll";
}

/** Point buy's starting scores, every ability at 8 and no point spent. */
export const POINT_BUY_START = Object.fromEntries(
  ABILITIES.map((ability) => [ability, POINT_MIN]),
) as Scores;

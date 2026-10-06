import {
  ABILITIES,
  ABILITY_LABEL,
  type Ability,
  abilityModifier,
  abilityScoreBreakdown,
  type CharacterDefinition,
  savingThrowModifier,
  skillModifier,
} from "@dnd/character";
import { rollDice } from "@dnd/dice";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { signed } from "../../components/blocks/signed.ts";
import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { Select } from "../../components/Select.tsx";
import { AbilityIncreasesField } from "./AbilityIncreasesField.tsx";
import {
  type AbilitiesMemory,
  METHODS,
  type Method,
  methodDeparture,
  methodOf,
  POINT_BUDGET,
  POINT_BUY_START,
  pointsSpent,
  SCORES_FIELD,
  type Scores,
  STANDARD_ARRAY,
} from "./abilityMethods.ts";
import { ChoicePills } from "./ChoicePills.tsx";
import { withDeparture } from "./departures.ts";
import { NO_GRANTS } from "./grants.ts";
import { useIncreaseOptions } from "./useIncreaseOptions.ts";
import { useSkillAbilities } from "./useSkillAbilities.ts";

const ROLL = "4d6kh3";

const UNSET = Object.fromEntries(ABILITIES.map((ability) => [ability, 0])) as Record<
  Ability,
  number
>;

/** The array's values for one ability, each marked with the abilities already holding it. */
const standardOptions = (scores: Scores, ability: Ability) => [
  { value: "", label: "—" },
  ...STANDARD_ARRAY.map((value) => {
    const holders = ABILITIES.filter((other) => other !== ability && scores[other] === value);
    return {
      value: String(value),
      label: String(value),
      hint: holders.length > 0 ? `used by ${holders.join(", ").toUpperCase()}` : undefined,
    };
  }),
];

/** Digits only, so a half-typed or cleared score leaves the ability unset. */
const parseScore = (raw: string) => (/^\d+$/.test(raw.trim()) ? Number(raw.trim()) : undefined);

/**
 * The six scores, by the standard array, point buy, a roll of 4d6 dropping the lowest, or
 * typed in, then the race's and background's increases on top as terms of their own. A
 * value the method does not allow is kept and noted as a departure rather than refused.
 * Changing method starts its scores afresh: the array unassigned, point buy at 8 across,
 * a fresh roll; typing keeps whatever was there. A step the flow holds no memory for, as
 * after a reload, reads its method off the scores.
 */
export function AbilityScoresStep({
  memory,
  onMemory,
}: {
  memory: AbilitiesMemory | undefined;
  onMemory: (memory: AbilitiesMemory) => void;
}) {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const [stored, increases, proficiencies, levels, edition = "one"] = useWatch<
    CharacterDefinition,
    ["abilityScores", "abilityIncreases", "proficiencies", "levels", "edition"]
  >({ name: ["abilityScores", "abilityIncreases", "proficiencies", "levels", "edition"] });
  const skills = useSkillAbilities(edition);
  const scores: Scores = stored ?? {};
  const sources = useIncreaseOptions();
  const [{ method, rolls }, setHeld] = useState<AbilitiesMemory>(
    () =>
      memory ?? {
        method: methodOf(getValues("abilityScores") ?? {}, getValues("departures")),
        rolls: {},
      },
  );
  const hold = (next: AbilitiesMemory) => {
    setHeld(next);
    onMemory(next);
  };

  const write = (next: Scores, as: Method) => {
    setValue("abilityScores", next as CharacterDefinition["abilityScores"], { shouldDirty: true });
    setValue(
      "departures",
      withDeparture(getValues("departures"), SCORES_FIELD, methodDeparture(as, next)),
      { shouldDirty: true },
    );
  };
  const setScore = (ability: Ability, score: number | undefined) => {
    const { [ability]: _, ...rest } = scores;
    write(score === undefined ? rest : { ...rest, [ability]: score }, method);
  };
  const rollAll = () => {
    const rolled = ABILITIES.map((ability) => [ability, rollDice(ROLL)] as const);
    hold({
      method: "roll",
      rolls: Object.fromEntries(rolled.map(([ability, roll]) => [ability, roll.dice])),
    });
    write(Object.fromEntries(rolled.map(([ability, roll]) => [ability, roll.total])), "roll");
  };

  const draft = {
    abilityScores: { ...UNSET, ...scores },
    abilityIncreases: increases ?? [],
    proficiencies: proficiencies ?? NO_GRANTS,
    // A draft with no class yet scores at level 1, as the character will once it has one.
    levels: levels?.length ? levels : [{ class: { name: "", source: "" } }],
  };
  const spent = pointsSpent(scores);

  return (
    <div className="flex flex-col gap-4">
      <ChoicePills
        legend="Method"
        options={METHODS}
        value={method}
        onChange={(value) => {
          const next = value as Method;
          hold({ method: next, rolls: {} });
          if (next === "roll") rollAll();
          else
            write(next === "standard" ? {} : next === "pointBuy" ? POINT_BUY_START : scores, next);
        }}
      />
      {method === "standard" && (
        <p className="text-muted text-row">Assign each value once: {STANDARD_ARRAY.join(", ")}.</p>
      )}
      {method === "pointBuy" && (
        <p
          aria-live="polite"
          className={`font-semibold text-row ${spent > POINT_BUDGET ? "text-error" : "text-muted"}`}
        >
          {spent} of {POINT_BUDGET} points spent,{" "}
          {spent > POINT_BUDGET
            ? `over budget by ${spent - POINT_BUDGET}`
            : `${POINT_BUDGET - spent} remaining`}
        </p>
      )}
      {method === "roll" && (
        <button
          type="button"
          onClick={rollAll}
          className="w-fit rounded-control border border-border bg-surface px-3 py-1 font-semibold text-body"
        >
          Reroll all ({ROLL})
        </button>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {ABILITIES.map((ability) => {
          const base = scores[ability];
          const { total, terms } = abilityScoreBreakdown(draft, ability);
          const modifier = abilityModifier(total);
          const save = savingThrowModifier(draft, ability).total;
          const governed = skills
            .filter((skill) => skill.ability === ability)
            .map(({ ref }) => `${ref.name} ${signed(skillModifier(draft, ref, ability).total)}`);
          const label = ABILITY_LABEL[ability];
          return (
            <fieldset
              key={ability}
              aria-label={label}
              className="flex flex-col gap-1 rounded-control bg-subtle px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="w-9 font-bold text-muted text-row uppercase">
                  {ability}
                </span>
                {method === "standard" ? (
                  <FormField label={`${label} base score`} labelHidden>
                    {(control) => (
                      <Select
                        {...control}
                        options={standardOptions(scores, ability)}
                        value={base === undefined ? "" : String(base)}
                        onChange={(value) => setScore(ability, parseScore(value))}
                      />
                    )}
                  </FormField>
                ) : method === "roll" ? (
                  <span className="flex items-center gap-2">
                    <span className="w-8 text-center font-semibold">{base ?? "—"}</span>
                    {rolls[ability] && (
                      <span className="text-muted text-row">
                        <span className="sr-only">rolled </span>
                        {rolls[ability].map((die, index) => (
                          <span
                            // biome-ignore lint/suspicious/noArrayIndexKey: a die is its position in the roll.
                            key={index}
                            className={die.kept ? "mr-1" : "mr-1 line-through"}
                          >
                            {die.value}
                            {!die.kept && <span className="sr-only"> dropped</span>}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                ) : (
                  <InputField
                    label={`${label} base score`}
                    labelHidden
                    type="number"
                    inputMode="numeric"
                    value={base ?? ""}
                    onChange={(event) => setScore(ability, parseScore(event.target.value))}
                    className="w-16 text-center"
                  />
                )}
                <span className="text-muted text-row">
                  {terms
                    .slice(1)
                    .map((term) => `${signed(term.value)} ${term.label.toLowerCase()}`)
                    .join(", ")}
                </span>
                <span className="ml-auto flex items-baseline gap-3">
                  {base === undefined ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <>
                      <span className="font-bold text-[15px]">
                        <span className="sr-only">Score </span>
                        {total}
                      </span>
                      <span className="font-bold text-accent-text text-row">
                        <span className="sr-only">Modifier </span>
                        {signed(modifier)}
                      </span>
                      <span className="text-muted text-row">Save {signed(save)}</span>
                    </>
                  )}
                </span>
              </div>
              {base !== undefined && governed.length > 0 && (
                <p className="text-muted text-row">{governed.join(", ")}</p>
              )}
            </fieldset>
          );
        })}
      </div>
      {sources && <AbilityIncreasesField sources={sources} />}
    </div>
  );
}

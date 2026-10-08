import {
  averageHitPoints,
  type CharacterDefinition,
  entryKey,
  HIT_DICE,
  type HitDie,
  maxHitPoints,
} from "@dnd/character";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { ChoicePills } from "./ChoicePills.tsx";
import { rerolled, rollHitDie } from "./classLevels.ts";
import { DepartureMark } from "./DepartureMark.tsx";
import { FirstLevel } from "./FirstLevel.tsx";
import { GainInput } from "./GainInput.tsx";
import {
  type HitPointMethod,
  hitPointMethodOf,
  isGainField,
  outsideDie,
  withGainDepartures,
} from "./hitPointGains.ts";
import { useClassEntries } from "./useClassEntries.ts";

const METHODS = [
  { value: "average", label: "Average" },
  { value: "roll", label: "Roll" },
  { value: "custom", label: "Custom" },
] as const;

export interface HitPointsFieldProps {
  /** The method the flow held from an earlier visit, which a reload loses. */
  memory?: HitPointMethod;
  onMemory?: (method: HitPointMethod) => void;
}

/**
 * How hit points grow past 1st level: the class table's fixed value, a roll of the hit die,
 * or a number typed for each level, as the player chooses, each level on its own class's
 * die. Roll fills every level after the first that holds no gain, including one a raised
 * level or a class change adds, and keeps a typed one; Reroll rolls them all again. Average
 * drops every gain. Custom keeps them, and a level left blank takes the average. A gain the
 * die cannot roll is kept and noted as a departure. Constitution is set on a later step, so
 * the total here stops short of it.
 */
export function HitPointsField({ memory, onMemory }: HitPointsFieldProps) {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const { levels, entries } = useClassEntries();
  const dieOf = new Map(entries.map((entry) => [entryKey(entry.cls), entry.hitDie]));
  const dice = levels.map((level) => dieOf.get(entryKey(level.class)) ?? 0) as HitDie[];
  const known = levels.length > 0 && dice.every((die) => HIT_DICE.includes(die));
  const diceKey = dice.join();
  const [method, setMethod] = useState<HitPointMethod | undefined>(memory);
  const [messages, setMessages] = useState<HTMLDivElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `diceKey` stands for `dice`, rebuilt each render.
  useEffect(() => {
    // The guess waits on the dice, since a gain reads as typed only against the die it beats.
    if (method === undefined && known) setMethod(hitPointMethodOf(levels, dice));
  }, [method, known, levels, diceKey]);
  const unrolled = levels.some((level, index) => index > 0 && level.rolled === undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `diceKey` stands for `dice`, rebuilt each render.
  useEffect(() => {
    if (method !== "roll" || !known || !unrolled) return;
    setValue(
      "levels",
      levels.map((level, index) =>
        index === 0 || level.rolled !== undefined
          ? level
          : { ...level, rolled: rollHitDie(dice[index] as HitDie) },
      ),
      { shouldDirty: true },
    );
  }, [method, known, diceKey, unrolled, levels, setValue]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `diceKey` stands for `dice`, rebuilt each render.
  useEffect(() => {
    // Until every die loads, a stored gain cannot be judged, so its note stands.
    if (levels.length > 0 && !known) return;
    const departures = getValues("departures");
    const next = withGainDepartures(departures, levels, dice);
    if (JSON.stringify(next) !== JSON.stringify(departures ?? []))
      setValue("departures", next, { shouldDirty: true });
  }, [levels, known, diceKey, getValues, setValue]);

  // The sheet counts no hit points on another die, so neither does this step.
  if (!known) return null;
  const first = dice[0] as HitDie;
  const mixed = dice.some((die) => die !== first);
  const faces = levels.map((level, index) =>
    index === 0 ? first : (level.rolled ?? averageHitPoints(dice[index] as HitDie)),
  );
  // Constitution is set on a later step, so the sheet's own sum runs at a modifier of 0.
  const { total } = maxHitPoints(
    levels.map((level, index) => ({ die: dice[index] as HitDie, rolled: level.rolled })),
    0,
  );
  const choose = (value: HitPointMethod) => {
    setMethod(value);
    onMemory?.(value);
    if (value === "average") setValue("levels", rerolled(levels), { shouldDirty: true });
  };
  const type = (at: number, gain: number | undefined) =>
    setValue(
      "levels",
      levels.map((level, index) => {
        if (index !== at) return level;
        const { rolled: _, ...rest } = level;
        return gain === undefined ? rest : { ...rest, rolled: gain };
      }),
      { shouldDirty: true },
    );

  return (
    <section aria-labelledby="hit-points" className="flex flex-col gap-1">
      <h2 id="hit-points" className="font-semibold text-label text-muted uppercase tracking-label">
        Hit points
      </h2>
      <ChoicePills
        legend={
          mixed
            ? "Each level after the first, on its class's hit die"
            : `Each level after the first, on a d${first}`
        }
        options={METHODS}
        value={method}
        onChange={(value) => choose(value as HitPointMethod)}
      />
      {method === "roll" && levels.length > 1 && (
        <button
          type="button"
          onClick={() =>
            setValue(
              "levels",
              rerolled(levels, (index) => rollHitDie(dice[index] as HitDie)),
              { shouldDirty: true },
            )
          }
          className="mt-1 w-fit rounded-control border border-border bg-surface px-3 py-1 font-semibold text-body"
        >
          Reroll
        </button>
      )}
      <p className="mt-2 text-muted text-row">Hit points at each level</p>
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-1 text-body">
        {faces.map((face, index) => {
          const level = index + 1;
          const gain = levels[index]?.rolled;
          const die = dice[index] as HitDie;
          return (
            <div
              key={level}
              className="flex flex-col items-center rounded-control border border-border p-1"
            >
              <dt className="whitespace-nowrap text-muted text-row">
                Level {level}
                {mixed && <span className="block"> d{die}</span>}
              </dt>
              <dd className="w-full text-center">
                {index === 0 ? (
                  <FirstLevel die={first} custom={method === "custom"} />
                ) : method === "custom" ? (
                  <GainInput
                    level={level}
                    gain={gain}
                    average={averageHitPoints(die)}
                    messages={messages}
                    onGain={(next) => type(index, next)}
                  />
                ) : (
                  <>
                    {face}
                    {outsideDie(gain, die) && (
                      <span className="block text-muted text-row">typed</span>
                    )}
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <div ref={setMessages} className="flex flex-col" />
      <DepartureMark field={isGainField} />
      <p className="mt-1 text-body">
        Total: <strong>{total}</strong>{" "}
        <span className="text-muted">
          before your Constitution modifier, which the sheet adds to each level
        </span>
      </p>
    </section>
  );
}

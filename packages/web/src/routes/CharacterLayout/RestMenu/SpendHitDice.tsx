import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  deathSaveStatus,
  derivedValue,
  hitDieSpentState,
  sheetState,
} from "@dnd/character";
import { rollDice } from "@dnd/dice";
import { useState } from "react";
import { Announcer } from "../../../components/Announcer.tsx";
import { useAnnouncedStateWrite } from "../../../hooks/useAnnouncedStateWrite.ts";
import { useRecordRoll } from "../../../hooks/useRecordRoll.ts";
import { CalculatedDie } from "./CalculatedDie.tsx";

/** What this dialog has spent from one pool, in order with the calculation behind each, and the hit points it regained in all. */
type Spent = { results: { amount: number; calculation: string }[]; regained: number };

const signed = (modifier: number) => (modifier < 0 ? `- ${-modifier}` : `+ ${modifier}`);

const hitDieNotation = (die: number, modifier: number) =>
  `1d${die}${modifier === 0 ? "" : `${modifier < 0 ? "-" : "+"}${Math.abs(modifier)}`}`;

/** "d8: rolled 5 + 2 (Con) = 7 HP", with a note where the rules floor or the maximum cut it short. */
function describeSpend(
  die: number,
  face: number,
  modifier: number,
  healing: number,
  amount: number,
) {
  const notes = [
    face + modifier < healing && `floored to ${healing}`,
    amount < healing && "capped at max HP",
  ].filter(Boolean);
  const note = notes.length ? ` (${notes.join(", ")})` : "";
  return `d${die}: rolled ${face} ${signed(modifier)} (Con) = ${amount} HP${note}`;
}

/**
 * One button per hit die size, each spending a die of that size: it rolls the die with the
 * Constitution modifier, writes the pool and the hit points in one state write, and only
 * then records the roll in the character's log, so a write that fails spends and logs
 * nothing. A pool with none left, or a dead character, leaves the buttons unavailable. Each
 * pool draws a die face per die: a spent die shows what it regained in this dialog, a
 * remaining die is blank. The hit points a pool regained show under its row, over a running
 * hit point readout, and each result is announced in full.
 */
export function SpendHitDice({
  character,
  derived,
  state,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  state: CharacterState;
}) {
  const replace = useAnnouncedStateWrite(character.id);
  const record = useRecordRoll(character.id);
  const [spent, setSpent] = useState<Record<number, Spent>>({});
  const [unlogged, setUnlogged] = useState(false);
  const pools = sheetState(derived, state).hitDice;
  const maximum = derivedValue(derived.hitPointMaximum);
  const dead = deathSaveStatus(derived, state) === "dead";
  const none = pools.every((pool) => pool.remaining < 1);
  const unavailable = dead || none;

  async function spend(die: (typeof pools)[number]["die"]) {
    if (replace.writing) return;
    const modifier = derivedValue(derived.abilityModifiers.con);
    const rolled = rollDice(hitDieNotation(die, modifier));
    const face = rolled.dice[0]?.value ?? 0;
    const result = hitDieSpentState(character.definition, derived, state, die, face);
    if (!result) return;
    const hitPoints = result.state.hitPoints.current ?? maximum;
    const amount = hitPoints - (state.hitPoints.current ?? maximum);
    const calculation = describeSpend(die, face, modifier, result.regained, amount);
    const sentence = `d${die}: rolled ${face} ${signed(modifier)}, regained ${amount} hit points. Hit points ${hitPoints} of ${maximum}.`;
    setUnlogged(false);
    if (!(await replace.write(result.state, sentence))) return;
    setSpent((rows) => ({
      ...rows,
      [die]: {
        results: [...(rows[die]?.results ?? []), { amount, calculation }],
        regained: (rows[die]?.regained ?? 0) + amount,
      },
    }));
    try {
      await record.mutateAsync({
        label: `Hit die d${die}`,
        notation: rolled.notation,
        total: rolled.total,
        dice: rolled.dice,
        modifier: rolled.modifier,
        critical: rolled.critical,
      });
    } catch {
      setUnlogged(true);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">Spend hit dice</h3>
      <ul className="flex flex-col gap-2">
        {pools.map((pool) => {
          const blocked = unavailable || pool.remaining < 1;
          const used = pool.total - pool.remaining;
          const here = spent[pool.die];
          const results = here?.results.slice(-used) ?? [];
          return (
            <li key={pool.die} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  aria-label={`Roll d${pool.die}, ${pool.remaining} of ${pool.total} left`}
                  aria-disabled={blocked || replace.writing}
                  onClick={() => (blocked ? undefined : spend(pool.die))}
                  className="min-h-11 rounded-control border border-border px-3 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:text-muted"
                >
                  {`Roll d${pool.die}`}
                </button>
                <span className="flex flex-wrap gap-1">
                  {Array.from({ length: pool.total }, (_, index) => {
                    const result =
                      index < used ? results[index - (used - results.length)] : undefined;
                    const filled = `bg-accent text-white forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]`;
                    const face =
                      "grid size-8 place-items-center rounded-control border-[1.5px] border-accent font-semibold text-row";
                    if (result) {
                      return (
                        <CalculatedDie
                          // biome-ignore lint/suspicious/noArrayIndexKey: dice in a pool are interchangeable.
                          key={index}
                          result={result}
                          className={`${face} ${filled}`}
                        />
                      );
                    }
                    return (
                      <span
                        // biome-ignore lint/suspicious/noArrayIndexKey: dice in a pool are interchangeable.
                        key={index}
                        role="img"
                        aria-label={`d${pool.die}, ${index < used ? "spent" : "not spent"}`}
                        className={`${face} ${index < used ? filled : ""}`}
                      />
                    );
                  })}
                </span>
                <span className="text-muted text-row">
                  {`d${pool.die} · ${pool.remaining} of ${pool.total} left`}
                </span>
              </div>
              {here && here.regained > 0 && <p className="text-row">{`+${here.regained} HP`}</p>}
            </li>
          );
        })}
      </ul>
      {unavailable && (
        <p className="text-muted text-row">
          {dead ? `${character.name} is dead.` : "No hit dice remain."}
        </p>
      )}
      {Object.keys(spent).length > 0 && (
        <p className="font-semibold text-row">
          <span className="sr-only">Hit points </span>
          {`${state.hitPoints.current ?? maximum} / ${maximum}`}
        </p>
      )}
      {unlogged && (
        <p role="alert" className="text-error text-row">
          The roll was not logged.
        </p>
      )}
      {replace.error && (
        <p role="alert" className="text-error text-row">
          The hit die was not spent: {replace.error.message}
        </p>
      )}
      <Announcer announced={replace.announced} />
    </div>
  );
}

import {
  atHitPointMaximum,
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  deathSaveStatus,
  derivedValue,
  type HitDie,
  hitDieSpentState,
  sheetState,
} from "@dnd/character";
import { rollDice } from "@dnd/dice";
import { useState } from "react";
import { Announcer } from "../../../components/Announcer.tsx";
import { CalculatedDie } from "./CalculatedDie.tsx";
import type { AppliedSpend, DialogSpend } from "./restChanges.ts";

const signed = (modifier: number) => (modifier < 0 ? `- ${-modifier}` : `+ ${modifier}`);

const hitDieNotation = (die: number, modifier: number) =>
  `1d${die}${modifier === 0 ? "" : `${modifier < 0 ? "-" : "+"}${Math.abs(modifier)}`}`;

/** "d8: rolled 5 + 2 (Con) = 7 HP", with a note where the rules floor or the maximum cut it short. */
function describeSpend({ die, face, modifier, regained, amount }: AppliedSpend<DialogSpend>) {
  const notes = [
    face + modifier < regained && `floored to ${regained}`,
    amount < regained && "capped at max HP",
  ].filter(Boolean);
  const note = notes.length ? ` (${notes.join(", ")})` : "";
  return `d${die}: rolled ${face} ${signed(modifier)} (Con) = ${amount} HP${note}`;
}

/**
 * One button per hit die size, each spending a die of that size: it rolls the die with the
 * Constitution modifier and hands `onChange` the spends with it added, writing nothing.
 * `state` is the state after `spends`, so the pools, the faces and the readout show them.
 * `spends` holds only those `spentState` applied. Undo hands back the spends without the
 * latest. A pool with none left, a dead character, or hit points at their maximum makes the
 * roll buttons unavailable, and `busy` makes every control unavailable. Each pool draws a die face per die: a die spent in this dialog shows
 * what it regained, a remaining die is blank. The hit points a pool regained show under its
 * row, over a running hit point readout, and each spend and undo is announced in full.
 */
export function SpendHitDice({
  character,
  derived,
  state,
  spends,
  busy,
  onChange,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  state: CharacterState;
  spends: readonly AppliedSpend<DialogSpend>[];
  busy: boolean;
  onChange: (spends: DialogSpend[]) => void;
}) {
  const [announced, setAnnounced] = useState({ text: "", count: 0 });
  const pools = sheetState(derived, state).hitDice;
  const maximum = derivedValue(derived.hitPointMaximum);
  const current = state.hitPoints.current ?? maximum;
  const dead = deathSaveStatus(derived, state) === "dead";
  const none = pools.every((pool) => pool.remaining < 1);
  const full = atHitPointMaximum(derived, state);
  const unavailable = dead || none || full;
  const latest = spends.at(-1);

  function announce(text: string) {
    setAnnounced(({ count }) => ({ text, count: count + 1 }));
  }

  function spend(die: HitDie) {
    if (busy) return;
    const modifier = derivedValue(derived.abilityModifiers.con);
    const rolled = rollDice(hitDieNotation(die, modifier));
    const face = rolled.dice[0]?.value ?? 0;
    const result = hitDieSpentState(character.definition, derived, state, die, face);
    if (!result) return;
    const hitPoints = result.state.hitPoints.current ?? maximum;
    onChange([
      ...spends,
      {
        die,
        face,
        roll: {
          label: `Hit die d${die}`,
          notation: rolled.notation,
          total: rolled.total,
          dice: rolled.dice,
          modifier: rolled.modifier,
          critical: rolled.critical,
        },
      },
    ]);
    announce(
      `d${die}: rolled ${face} ${signed(modifier)}, regained ${hitPoints - current} hit points. Hit points ${hitPoints} of ${maximum}.`,
    );
  }

  function undo() {
    if (busy || !latest) return;
    onChange(spends.slice(0, -1));
    announce(
      `Undid the d${latest.die} spend: ${latest.amount} hit points removed. Hit points ${current - latest.amount} of ${maximum}.`,
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">Spend hit dice</h3>
      <ul className="flex flex-col gap-2">
        {pools.map((pool) => {
          const blocked = unavailable || pool.remaining < 1;
          const used = pool.total - pool.remaining;
          const here = spends.filter((each) => each.die === pool.die);
          const results = used > 0 ? here.slice(-used) : [];
          const regained = here.reduce((sum, each) => sum + each.amount, 0);
          return (
            <li key={pool.die} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  aria-label={`Roll d${pool.die}, ${pool.remaining} of ${pool.total} left`}
                  aria-disabled={blocked || busy}
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
                          result={{ amount: result.amount, calculation: describeSpend(result) }}
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
              {regained > 0 && <p className="text-row">{`+${regained} HP`}</p>}
            </li>
          );
        })}
      </ul>
      {unavailable && (
        <p className="text-muted text-row">
          {dead
            ? `${character.name} is dead.`
            : none
              ? "No hit dice remain."
              : "Hit points are full."}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-label="Undo the latest hit die spent"
          aria-disabled={!latest || busy}
          onClick={undo}
          className="min-h-11 rounded-control border border-border px-3 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:text-muted"
        >
          Undo
        </button>
        {latest && (
          <p className="font-semibold text-row">
            <span className="sr-only">Hit points </span>
            {`${current} / ${maximum}`}
          </p>
        )}
      </div>
      <Announcer announced={announced} />
    </div>
  );
}

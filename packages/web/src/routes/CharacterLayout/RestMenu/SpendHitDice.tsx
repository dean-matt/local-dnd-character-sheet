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

type Spent = { id: number; text: string };

const signed = (modifier: number) => (modifier < 0 ? `- ${-modifier}` : `+ ${modifier}`);

/**
 * One button per hit die size, each spending a die of that size: it rolls the die with the
 * Constitution modifier, writes the pool and the hit points in one state write, and only
 * then records the roll in the character's log, so a write that fails spends and logs
 * nothing. A pool with none left, or a dead character, leaves the buttons unavailable. Each
 * pool draws a pip per die, filled while one remains. Each result is listed compactly under a
 * running hit point readout, and announced in full.
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
  const [spent, setSpent] = useState<Spent[]>([]);
  const [unlogged, setUnlogged] = useState(false);
  const pools = sheetState(derived, state).hitDice;
  const maximum = derivedValue(derived.hitPointMaximum);
  const dead = deathSaveStatus(derived, state) === "dead";
  const none = pools.every((pool) => pool.remaining < 1);
  const unavailable = dead || none;

  async function spend(die: (typeof pools)[number]["die"]) {
    if (replace.writing) return;
    const modifier = derivedValue(derived.abilityModifiers.con);
    const rolled = rollDice(
      modifier === 0 ? `1d${die}` : `1d${die}${modifier < 0 ? "-" : "+"}${Math.abs(modifier)}`,
    );
    const face = rolled.dice[0]?.value ?? 0;
    const result = hitDieSpentState(character.definition, derived, state, die, face);
    if (!result) return;
    const hitPoints = result.state.hitPoints.current ?? maximum;
    const sentence = `d${die}: rolled ${face} ${signed(modifier)}, regained ${result.regained} hit points. Hit points ${hitPoints} of ${maximum}.`;
    setUnlogged(false);
    if (!(await replace.write(result.state, sentence))) return;
    const line = `d${die} ${face} ${signed(modifier)} = +${result.regained} HP`;
    setSpent((rows) => [...rows, { id: rows.length, text: line }]);
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
      <ul className="flex flex-col gap-1">
        {pools.map((pool) => {
          const blocked = unavailable || pool.remaining < 1;
          return (
            <li key={pool.die} className="flex items-center gap-3">
              <button
                type="button"
                aria-label={`Roll d${pool.die}, ${pool.remaining} of ${pool.total} left`}
                aria-disabled={blocked || replace.writing}
                onClick={() => (blocked ? undefined : spend(pool.die))}
                className="min-h-11 rounded-control border border-border px-3 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:text-muted"
              >
                {`Roll d${pool.die}`}
              </button>
              <span aria-hidden="true" className="flex flex-wrap gap-[5px]">
                {Array.from({ length: pool.total }, (_, index) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: pips are interchangeable.
                    key={index}
                    className={`size-[19px] rounded-full border-[1.5px] border-accent ${index < pool.remaining ? "bg-accent forced-colors:bg-[Highlight]" : ""}`}
                  />
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      {unavailable && (
        <p className="text-muted text-row">
          {dead ? `${character.name} is dead.` : "No hit dice remain."}
        </p>
      )}
      {spent.length > 0 && (
        <>
          <ul className="flex flex-col gap-0.5 text-row">
            {spent.map((row) => (
              <li key={row.id}>{row.text}</li>
            ))}
          </ul>
          <p className="font-semibold text-row">
            <span className="sr-only">Hit points </span>
            {`${state.hitPoints.current ?? maximum} / ${maximum}`}
          </p>
        </>
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

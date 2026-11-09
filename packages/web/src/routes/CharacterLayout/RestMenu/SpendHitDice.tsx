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

/** What this dialog has spent from one pool: the faces rolled, in order, and the hit points regained. */
type Spent = { faces: number[]; regained: number };

const signed = (modifier: number) => (modifier < 0 ? `- ${-modifier}` : `+ ${modifier}`);

/**
 * One button per hit die size, each spending a die of that size: it rolls the die with the
 * Constitution modifier, writes the pool and the hit points in one state write, and only
 * then records the roll in the character's log, so a write that fails spends and logs
 * nothing. A pool with none left, or a dead character, leaves the buttons unavailable. Each
 * pool draws a die face per die: a spent die shows the number it rolled in this dialog, a
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
    setSpent((rows) => ({
      ...rows,
      [die]: {
        faces: [...(rows[die]?.faces ?? []), face],
        regained: (rows[die]?.regained ?? 0) + result.regained,
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
          const faces = here?.faces.slice(-used) ?? [];
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
                    const face = index < used ? faces[index - (used - faces.length)] : undefined;
                    const name =
                      index >= used
                        ? `d${pool.die}, not spent`
                        : face === undefined
                          ? `d${pool.die}, spent`
                          : `d${pool.die}, rolled ${face}`;
                    return (
                      <span
                        // biome-ignore lint/suspicious/noArrayIndexKey: dice in a pool are interchangeable.
                        key={index}
                        role="img"
                        aria-label={name}
                        className={`grid size-8 place-items-center rounded-control border-[1.5px] border-accent font-semibold text-row ${index < used ? "bg-accent text-white forced-colors:bg-[Highlight]" : ""}`}
                      >
                        {face}
                      </span>
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

import { rowEntries } from "@dnd/catalog";
import { type CharacterRecord, displayName, type HitDie, improvementAt } from "@dnd/character";
import { useCharacterDerived } from "../../../hooks/useCharacterDerived.ts";
import { useClassFeatures } from "../../../hooks/useClassFeatures.ts";
import { useHeldWrites } from "../../../hooks/useHeldWrites.ts";
import { useLevelDice } from "../../../hooks/useLevelDice.ts";
import { useSaveToast } from "../../../hooks/useSaveToast.ts";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { improvementText } from "../../../lib/improvementChoice.ts";
import { type GainEdit, withLevelGain } from "../../../lib/levelGain.ts";
import { type HistoryFeature, levelHistory } from "../../../lib/levelHistory.ts";
import { Card } from "../../Card.tsx";
import { DetailTrigger } from "../../DetailTrigger.tsx";
import { RulesEntries } from "../../RulesEntries/RulesEntries.tsx";
import { LevelGainEdit } from "./LevelGainEdit.tsx";
import { LevelRemoval } from "./LevelRemoval.tsx";
import { LevelUp } from "./LevelUp/LevelUp.tsx";

const HEAD = "px-1 pb-0.5 text-left";
const CELL = "px-1 py-1 text-left align-top";

/** A feature's name, followed by its grantor and level where another in the row shares it. */
function featureLabel(feature: HistoryFeature, row: readonly HistoryFeature[]): string {
  const { name, level } = feature.record;
  const shared = row.filter((other) => other.record.name === name).length > 1;
  return shared ? `${name} (${feature.grantor} ${level})` : name;
}

/**
 * What the character gained at each level, oldest first: the class level taken, the hit
 * points it added, the subclass chosen there, the features it granted and the improvement
 * taken. Hit points show the derived maximum's own per-level term, and wait while a write
 * recomputes it rather than show a gain the sheet no longer holds. Each level's gain can be
 * changed in place, each change one write and one undo entry, as can the choices each level
 * past the first made, and the newest level, past the first, can be removed.
 */
export function LevelHistory({ character }: { character: CharacterRecord }) {
  const { definition } = character;
  const features = useClassFeatures(definition.levels);
  const derived = useCharacterDerived(character.id);
  const terms = derived.data?.hitPointMaximum.terms;
  const hitPoints = terms?.length === definition.levels.length ? terms : undefined;
  const rows = levelHistory(definition.levels, features.featuresOf);
  const newest = rows.at(-1);
  const dice = useLevelDice(definition.levels);
  const writes = useHeldWrites(useUpdateCharacterDefinition(character.id), {
    ownUndoEntry: true,
  });
  const failure = writes.latest;
  useSaveToast(
    `Level ${failure?.key} hit points`,
    failure ? `Couldn't save: ${failure.error.message}` : undefined,
    writes.retry,
    failure?.error,
  );

  function edit(level: number, change: GainEdit) {
    if (dice)
      writes.write(String(level), (latest) => withLevelGain(latest, level - 1, change, dice));
  }

  return (
    <Card title="Level History">
      {features.failed && (
        <p className="mb-2 text-body text-muted italic">Some class features could not load.</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-body">
          <thead className="font-semibold text-[10px] text-muted uppercase tracking-[0.06em]">
            <tr>
              <th scope="col" className={`${HEAD} w-px`}>
                Lvl
              </th>
              <th scope="col" className={`${HEAD} w-px`}>
                Class
              </th>
              <th scope="col" className={HEAD}>
                HP
              </th>
              <th scope="col" className={HEAD}>
                Gained
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const term = hitPoints?.[row.level - 1];
              const improvement = improvementAt(definition, row.level);
              const taken = improvement && improvementText(improvement);
              return (
                <tr key={row.level} className="border-border border-t">
                  <th scope="row" className={`${CELL} font-semibold tabular-nums`}>
                    {row.level}
                  </th>
                  <td className={`${CELL} whitespace-nowrap`}>
                    {displayName(row.cls)} {row.classLevel}
                  </td>
                  <td className={CELL}>
                    {term ? (
                      <>
                        <span className="font-semibold">+{term.value}</span>{" "}
                        <span className="text-label text-muted">({term.label})</span>
                      </>
                    ) : derived.isError ? (
                      "unavailable"
                    ) : (
                      "…"
                    )}
                    {dice && (
                      <LevelGainEdit
                        level={row.level}
                        die={dice[row.level - 1] as HitDie}
                        entry={definition.levels[row.level - 1] ?? {}}
                        onEdit={(change) => edit(row.level, change)}
                        invalid={writes.failed.has(String(row.level))}
                      />
                    )}
                  </td>
                  <td className={CELL}>
                    {row.subclass && <p>Subclass: {row.subclass.name}</p>}
                    {row.features.map((feature) => {
                      const { name, source, level, json } = feature.record;
                      return (
                        <p key={`${feature.subclass}|${name}|${source}|${level}`}>
                          <DetailTrigger
                            title={name}
                            meta={`${feature.grantor} • Level ${level} • ${source}`}
                            detail={<RulesEntries entries={rowEntries(json)} />}
                            className="underline"
                          >
                            {featureLabel(feature, row.features)}
                          </DetailTrigger>
                        </p>
                      );
                    })}
                    {taken && <p>Improvement: {taken}</p>}
                    {row.level > 1 && <LevelUp character={character} reopen={row.level} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {newest && rows.length > 1 && <LevelRemoval character={character} row={newest} />}
    </Card>
  );
}

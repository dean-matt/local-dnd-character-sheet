import { rowEntries } from "@dnd/catalog";
import { type CharacterRecord, displayName, improvementAt } from "@dnd/character";
import { useCallback, useState } from "react";
import { useCharacterDerived } from "../../../hooks/useCharacterDerived.ts";
import { useClassFeatures } from "../../../hooks/useClassFeatures.ts";
import { useHomebrewNames } from "../../../hooks/useHomebrewNames.ts";
import { improvementText } from "../../../lib/improvementChoice.ts";
import { type HistoryFeature, levelHistory } from "../../../lib/levelHistory.ts";
import { Card } from "../../Card.tsx";
import { DetailTrigger } from "../../DetailTrigger.tsx";
import { RulesEntries } from "../../RulesEntries/RulesEntries.tsx";
import { LevelEdit } from "./LevelEdit.tsx";

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
 * recomputes it rather than show a gain the sheet no longer holds. Each row ends in its Edit
 * button, whose dialog changes the level's gain and choices in one write and one undo entry,
 * or removes it.
 */
export function LevelHistory({ character }: { character: CharacterRecord }) {
  const names = useHomebrewNames();
  const { definition } = character;
  const features = useClassFeatures(definition.levels);
  const derived = useCharacterDerived(character.id);
  const terms = derived.data?.hitPointMaximum.terms;
  const hitPoints = terms?.length === definition.levels.length ? terms : undefined;
  const rows = levelHistory(definition.levels, features.featuresOf, names);
  const [focusLevel, setFocusLevel] = useState<number>();
  const focused = useCallback(() => setFocusLevel(undefined), []);

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
              <th scope="col" className={`${HEAD} w-px`}>
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const term = hitPoints?.[row.level - 1];
              const improvement = improvementAt(definition, row.level);
              const taken = improvement && improvementText(improvement, names);
              return (
                <tr key={row.level} className="border-border border-t">
                  <th scope="row" className={`${CELL} font-semibold tabular-nums`}>
                    {row.level}
                  </th>
                  <td className={`${CELL} whitespace-nowrap`}>
                    {displayName(row.cls, names)} {row.classLevel}
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
                  </td>
                  <td className={CELL}>
                    <LevelEdit
                      character={character}
                      rows={rows.slice(row.level - 1)}
                      focusRequest={focusLevel === row.level}
                      onFocused={focused}
                      onRemoved={() => setFocusLevel(row.level - 1)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

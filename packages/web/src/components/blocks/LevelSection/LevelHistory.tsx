import { rowEntries } from "@dnd/catalog";
import { type CharacterRecord, improvementAt } from "@dnd/character";
import { useCharacterDerived } from "../../../hooks/useCharacterDerived.ts";
import { useClassFeatures } from "../../../hooks/useClassFeatures.ts";
import { improvementText } from "../../../lib/improvementChoice.ts";
import { levelTitle } from "../../../lib/improvementGrants.ts";
import { type HistoryFeature, levelHistory } from "../../../lib/levelHistory.ts";
import { Card } from "../../Card.tsx";
import { DetailTrigger } from "../../DetailTrigger.tsx";
import { RulesEntries } from "../../RulesEntries/RulesEntries.tsx";

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
 * recomputes it rather than show a gain the sheet no longer holds.
 */
export function LevelHistory({ character }: { character: CharacterRecord }) {
  const { definition } = character;
  const features = useClassFeatures(definition.levels);
  const derived = useCharacterDerived(character.id);
  const terms = derived.data?.hitPointMaximum.terms;
  const hitPoints = terms?.length === definition.levels.length ? terms : undefined;
  const rows = levelHistory(definition.levels, features.featuresOf);

  return (
    <Card title="Level History">
      {features.failed && (
        <p className="mb-2 text-body text-muted italic">Some class features could not load.</p>
      )}
      <ol className="flex flex-col gap-2">
        {rows.map((row) => {
          const title = levelTitle(row.level, row.cls, row.classLevel);
          const term = hitPoints?.[row.level - 1];
          const improvement = improvementAt(definition, row.level);
          const taken = improvement && improvementText(improvement);
          return (
            <li key={row.level} className="flex flex-col gap-0.5 text-body">
              <p className="font-semibold">{title}</p>
              <p>
                Hit points:{" "}
                {term ? `+${term.value} (${term.label})` : derived.isError ? "unavailable" : "…"}
              </p>
              {row.subclass && <p>Subclass: {row.subclass.name}</p>}
              {row.features.length > 0 && (
                <p>
                  Features:{" "}
                  {row.features.map((feature, index) => {
                    const { name, source, level, json } = feature.record;
                    return (
                      <span key={`${feature.subclass}|${name}|${source}|${level}`}>
                        {index > 0 && ", "}
                        <DetailTrigger
                          title={name}
                          meta={`${feature.grantor} • Level ${level} • ${source}`}
                          detail={<RulesEntries entries={rowEntries(json)} />}
                          className="underline"
                        >
                          {featureLabel(feature, row.features)}
                        </DetailTrigger>
                      </span>
                    );
                  })}
                </p>
              )}
              {taken && <p>Took: {taken}</p>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

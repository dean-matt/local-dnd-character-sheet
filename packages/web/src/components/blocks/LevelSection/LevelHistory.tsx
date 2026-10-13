import { rowEntries } from "@dnd/catalog";
import { type CharacterRecord, displayName, improvementAt } from "@dnd/character";
import { useCharacterDerived } from "../../../hooks/useCharacterDerived.ts";
import { useClassFeatures } from "../../../hooks/useClassFeatures.ts";
import { improvementText } from "../../../lib/improvementChoice.ts";
import { levelHistory } from "../../../lib/levelHistory.ts";
import { Card } from "../../Card.tsx";
import { DetailTrigger } from "../../DetailTrigger.tsx";
import { RulesEntries } from "../../RulesEntries/RulesEntries.tsx";

/**
 * What the character gained at each level, oldest first: the class level taken, the hit
 * points it added, the subclass chosen there, the features it granted and the improvement
 * taken. Hit points read the derived maximum's own per-level terms, so they wait while a
 * write recomputes it rather than show a gain the sheet no longer holds.
 */
export function LevelHistory({ character }: { character: CharacterRecord }) {
  const { definition } = character;
  const { featuresOf } = useClassFeatures(definition.levels);
  const derived = useCharacterDerived(character.id);
  const terms = derived.data?.hitPointMaximum.terms;
  const hitPoints = terms?.length === definition.levels.length ? terms : undefined;
  const rows = levelHistory(definition.levels, featuresOf);

  return (
    <Card title="Level History">
      <ol className="flex flex-col gap-2">
        {rows.map((row) => {
          const className = `${displayName(row.cls)} ${row.classLevel}`;
          const term = hitPoints?.[row.level - 1];
          const improvement = improvementAt(definition, row.level);
          const taken = improvement && improvementText(improvement);
          return (
            <li key={row.level} className="flex flex-col gap-0.5 text-body">
              <p className="font-semibold">
                Level {row.level} · {className}
              </p>
              <p>
                Hit points:{" "}
                {term ? `+${term.value} (${term.label.replace(/^Level \d+: /, "")})` : "…"}
              </p>
              {row.subclass && <p>Subclass: {row.subclass.name}</p>}
              {row.features.length > 0 && (
                <p>
                  Features:{" "}
                  {row.features.map((feature, index) => (
                    <span key={`${feature.name}|${feature.source}`}>
                      {index > 0 && ", "}
                      <DetailTrigger
                        title={feature.name}
                        meta={`${className} • ${feature.source}`}
                        detail={<RulesEntries entries={rowEntries(feature.json)} />}
                        className="underline"
                      >
                        {feature.name}
                      </DetailTrigger>
                    </span>
                  ))}
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

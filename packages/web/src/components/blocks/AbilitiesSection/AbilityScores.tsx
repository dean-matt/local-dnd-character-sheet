import {
  ABILITIES,
  ABILITY_LABEL,
  type CharacterDefinition,
  type CharacterDerived,
} from "@dnd/character";
import { signed } from "../../../lib/signed.ts";
import { Card } from "../../Card.tsx";
import { Field } from "../../Field/Field.tsx";
import { ABILITY_RULES, editionRules } from "./abilityRules.ts";
import { StatTile } from "./StatTile.tsx";

const ABILITY_LABEL_CLASS = "text-[10px] tracking-[0.06em]";

export function AbilityScores({
  definition,
  derived,
}: {
  definition: CharacterDefinition;
  derived: CharacterDerived;
}) {
  return (
    <Card title="Ability Scores">
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITIES.map((ability) => (
          <StatTile
            key={ability}
            label={ability}
            name={ABILITY_LABEL[ability]}
            labelClassName={ABILITY_LABEL_CLASS}
            detail={{
              title: ABILITY_LABEL[ability],
              meta: `Score ${definition.abilityScores[ability]}`,
              value: derived.abilityModifiers[ability],
              rules: editionRules(definition, ABILITY_RULES),
            }}
          >
            <span>{definition.abilityScores[ability]}</span>
            <span className="sr-only">, </span>
            <span className="rounded-pill bg-accent px-2 font-semibold text-label text-white [&_.text-accent-text]:text-white">
              <Field
                mode="read"
                label="modifier"
                labelHidden
                value={derived.abilityModifiers[ability]}
                format={signed}
              />
            </span>
          </StatTile>
        ))}
      </dl>
    </Card>
  );
}

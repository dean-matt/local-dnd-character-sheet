import {
  ABILITIES,
  ABILITY_LABEL,
  abilityScoresSchema,
  type CharacterDerived,
  type CharacterRecord,
} from "@dnd/character";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { Card } from "../../Card.tsx";
import { Field } from "../../Field/Field.tsx";
import { signed } from "../signed.ts";
import { ABILITY_RULES, editionRules } from "./abilityRules.ts";
import { StatTile } from "./StatTile.tsx";

const ABILITY_LABEL_CLASS = "text-[10px] tracking-[0.06em]";

const parseScore = (raw: string) => Number(raw.trim());

export function AbilityScores({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const { definition } = character;
  const update = useUpdateCharacterDefinition(character.id);
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
            <Field
              mode="edit"
              label={`${ABILITY_LABEL[ability]} score`}
              labelHidden
              required
              current={definition.abilityScores[ability]}
              format={String}
              parse={parseScore}
              schema={abilityScoresSchema.valueType}
              inputClassName="w-12 text-center"
              onSave={async (score) => {
                await update.mutateAsync((latest) => ({
                  ...latest,
                  abilityScores: { ...latest.abilityScores, [ability]: score },
                }));
              }}
            />
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

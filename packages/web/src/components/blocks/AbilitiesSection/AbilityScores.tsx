import {
  ABILITIES,
  ABILITY_LABEL,
  abilityScore,
  abilityScoresSchema,
  type CharacterDerived,
  type CharacterRecord,
} from "@dnd/character";
import { useState } from "react";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { Card } from "../../Card.tsx";
import { Field } from "../../Field/Field.tsx";
import { signed } from "../signed.ts";
import { ABILITY_RULES, editionRules } from "./abilityRules.ts";
import { StatTile } from "./StatTile.tsx";

const ABILITY_LABEL_CLASS = "text-[10px] tracking-[0.06em]";

/** Digits only: `Number` reads "1e1" and "0x1E" as scores the user never typed. */
const parseScore = (raw: string) => (/^\d+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN);

export function AbilityScores({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const { definition } = character;
  const update = useUpdateCharacterDefinition(character.id);
  // A tile is too narrow for a sentence, so every score's message lands under the grid.
  const [messages, setMessages] = useState<HTMLDivElement | null>(null);
  return (
    <Card title="Ability Scores">
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITIES.map((ability) => {
          const score = abilityScore(definition, ability);
          return (
            <StatTile
              key={ability}
              label={ability}
              name={ABILITY_LABEL[ability]}
              labelClassName={ABILITY_LABEL_CLASS}
              detail={{
                title: ABILITY_LABEL[ability],
                meta: `Score ${score}`,
                value: derived.abilityModifiers[ability],
                rules: editionRules(definition, ABILITY_RULES),
              }}
            >
              <Field
                mode="edit"
                label={`${ABILITY_LABEL[ability]} score`}
                labelHidden
                current={score}
                format={String}
                parse={parseScore}
                schema={abilityScoresSchema.valueType}
                inputClassName="w-12 text-center"
                inputMode="numeric"
                messageSlot={{ into: messages, name: ABILITY_LABEL[ability] }}
                onSave={async (typed: number) => {
                  // The player edits the score they see; the base takes the difference, so
                  // a race's increase stays its own term.
                  await update.mutateAsync((latest) => ({
                    ...latest,
                    abilityScores: {
                      ...latest.abilityScores,
                      [ability]:
                        latest.abilityScores[ability] + typed - abilityScore(latest, ability),
                    },
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
          );
        })}
      </dl>
      <div ref={setMessages} className="flex flex-col" />
    </Card>
  );
}

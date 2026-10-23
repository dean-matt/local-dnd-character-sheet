import {
  ABILITIES,
  ABILITY_LABEL,
  type Ability,
  abilityScore,
  abilityScoreBreakdown,
  abilityScoresSchema,
  type CharacterDerived,
  type CharacterRecord,
  derivedValue,
} from "@dnd/character";
import { Info } from "lucide-react";
import { useId } from "react";
import { z } from "zod";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { Card } from "../../Card.tsx";
import { Field } from "../../Field/Field.tsx";
import { InputField } from "../../InputField.tsx";
import { Popover } from "../../Popover.tsx";
import { DerivedBreakdown } from "../DerivedBreakdown.tsx";
import { DerivedValue } from "../DerivedValue.tsx";
import { signed } from "../signed.ts";
import { ABILITY_RULES, editionRules } from "./abilityRules.ts";
import { StatTile } from "./StatTile.tsx";

const ABILITY_LABEL_CLASS = "text-[10px] tracking-[0.06em]";
const SCORE_BOX = "w-12 py-1 text-center text-number";

/**
 * The scores the player may type where increases move the base by `raised`:
 * the base an edit saves stays within the 1 to 30 the definition takes, and the score
 * never drops below 1, though an increase may carry it past 30.
 */
function scoreSchema(raised: number) {
  if (raised === 0) return abilityScoresSchema.valueType;
  const low = Math.max(1, 1 + raised);
  const error = `With ${signed(raised)} from increases, a score is a whole number from ${low} to ${30 + raised}.`;
  return z
    .int({ error })
    .min(low, { error })
    .max(30 + raised, { error });
}

/**
 * Why typing cannot move this score, or null where it can. Any item term locks it, a plain
 * bonus too: the save sets the base from the score without item grants, so a typed score
 * would land off by the bonus.
 */
function lockReason(
  definition: CharacterRecord["definition"],
  field: CharacterDerived["abilityScores"][Ability],
  ability: Ability,
): string | null {
  if (field.manual !== null) return "overridden";
  const own = abilityScoreBreakdown(definition, ability).terms.length;
  if (field.terms.length === own) return null;
  return `set by ${[...new Set(field.terms.slice(own).map((term) => term.label))].join(", ")}`;
}

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
  const reasonId = useId();
  return (
    <Card title="Ability Scores">
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITIES.map((ability) => {
          const { terms } = derived.abilityScores[ability];
          const score = derivedValue(derived.abilityScores[ability]);
          const raised = score - definition.abilityScores[ability];
          const locked = lockReason(definition, derived.abilityScores[ability], ability);
          const increases = terms
            .slice(1)
            .map((term) => `${signed(term.value)} ${term.label.toLowerCase()}`);
          return (
            <StatTile
              key={ability}
              label={ability}
              name={ABILITY_LABEL[ability]}
              labelClassName={ABILITY_LABEL_CLASS}
              detail={{
                title: ABILITY_LABEL[ability],
                meta:
                  derived.abilityScores[ability].manual !== null || increases.length === 0
                    ? `Score ${score}`
                    : `Score ${score}: base ${definition.abilityScores[ability]}, ${increases.join(", ")}`,
                value: derived.abilityModifiers[ability],
                rules: editionRules(definition, ABILITY_RULES),
                footer: (
                  <div className="flex-1">
                    {/* The meta line already lists the score's terms. */}
                    <DerivedBreakdown
                      name={`${ABILITY_LABEL[ability]} score`}
                      label="Score override"
                      value={{ ...derived.abilityScores[ability], terms: [] }}
                      format={String}
                      overrideKey={`abilityScores.${ability}`}
                    />
                    {derived.abilityScores[ability].manual !== null && (
                      <p className="mt-1 text-muted">
                        The modifier and every roll still read the computed score.
                      </p>
                    )}
                  </div>
                ),
              }}
            >
              {locked === null ? (
                <Field
                  mode="edit"
                  label={`${ABILITY_LABEL[ability]} score`}
                  labelHidden
                  current={score}
                  format={String}
                  parse={parseScore}
                  schema={scoreSchema(raised)}
                  inputClassName={SCORE_BOX}
                  inputMode="numeric"
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
              ) : (
                <span className="relative">
                  <InputField
                    label={`${ABILITY_LABEL[ability]} score`}
                    labelHidden
                    type="text"
                    readOnly
                    value={String(score)}
                    describedBy={`${reasonId}-${ability}`}
                    className={`${SCORE_BOX} border-dashed bg-subtle text-muted`}
                  />
                  <span id={`${reasonId}-${ability}`} className="sr-only">
                    {locked}; change it with Score override in the details
                  </span>
                  <span className="-translate-y-1/2 absolute top-1/2 left-full ml-0.5 font-normal text-muted">
                    <Popover
                      trigger={<Info aria-hidden="true" size={14} />}
                      triggerLabel={`Why the ${ABILITY_LABEL[ability]} score is locked`}
                      label={`${ABILITY_LABEL[ability]} score`}
                    >
                      <span className="text-row">{locked}</span>
                    </Popover>
                  </span>
                </span>
              )}
              <span className="rounded-pill bg-accent px-2 font-semibold text-label text-white [&_.text-accent-text]:text-white">
                <DerivedValue
                  name={`${ABILITY_LABEL[ability]} modifier`}
                  value={derived.abilityModifiers[ability]}
                  overrideKey={`abilityModifiers.${ability}`}
                />
              </span>
            </StatTile>
          );
        })}
      </dl>
    </Card>
  );
}

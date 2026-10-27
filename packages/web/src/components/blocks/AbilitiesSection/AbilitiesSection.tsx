/**
 * The numbers a player reads constantly. Every computed number comes off the derived
 * block; the definition supplies only what a player chose — the scores, which saves and
 * skills they are proficient in, and the skills they hold — the derived block what feats
 * grant beside them, and `Vitals` reads what play has spent from state. A number opens its
 * terms and override in a popover; an ability, a save or a skill opens its terms and the
 * catalog's rules text in a modal.
 */
import {
  ABILITIES,
  ABILITY_LABEL,
  type CharacterDerived,
  type CharacterRecord,
  derivedValue,
  effectsOnRoll,
} from "@dnd/character";
import { useRef, useState } from "react";
import { EmptyState } from "../../../EmptyState.tsx";
import { Card } from "../../Card.tsx";
import { AbilityScores } from "./AbilityScores.tsx";
import { AddHomebrewSkill } from "./AddHomebrewSkill.tsx";
import { Attacks } from "./Attacks/Attacks.tsx";
import { editionRules, SAVE_RULES } from "./abilityRules.ts";
import { CatalogSkills } from "./CatalogSkills.tsx";
import { CombatStats } from "./CombatStats.tsx";
import { Defenses } from "./Defenses/Defenses.tsx";
import { FeatGrants } from "./FeatGrants.tsx";
import { ItemGrants } from "./ItemGrants.tsx";
import { PassiveScores } from "./PassiveScores/PassiveScores.tsx";
import { ProficiencyLegend } from "./ProficiencyLegend.tsx";
import { ProficiencyRow } from "./ProficiencyRow.tsx";
import { Senses } from "./Senses.tsx";
import { Vitals } from "./Vitals/Vitals.tsx";

export function AbilitiesSection({
  character,
  derived,
}: {
  character: CharacterRecord | undefined;
  derived: CharacterDerived | undefined;
}) {
  const addButton = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState("");
  if (!character || !derived) return <EmptyState>Abilities isn't available yet.</EmptyState>;
  const { definition } = character;

  const saveProficient = new Set([
    ...definition.proficiencies.savingThrows,
    ...derivedValue(derived.featGrants).savingThrows.map(({ name }) => name),
  ]);
  const rollEffects = derivedValue(derived.rollEffects);

  return (
    <div className="flex flex-col gap-3">
      <AbilityScores character={character} derived={derived} />
      <CombatStats definition={definition} derived={derived} />
      <Vitals character={character} derived={derived} />
      <Attacks character={character} derived={derived} />
      <Defenses character={character} derived={derived} />
      <Senses derived={derived} />
      <ItemGrants derived={derived} />
      <FeatGrants derived={derived} />
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card title="Saving Throws">
          <ul className="flex flex-col gap-0.5">
            {ABILITIES.map((ability) => (
              <ProficiencyRow
                key={ability}
                level={saveProficient.has(ability) ? "proficient" : "none"}
                name={ABILITY_LABEL[ability]}
                label={ability.toUpperCase()}
                modifier={derived.savingThrows[ability]}
                overrideKey={`savingThrows.${ability}`}
                title={`${ABILITY_LABEL[ability]} saving throw`}
                rules={editionRules(definition, SAVE_RULES)}
                effects={effectsOnRoll(rollEffects, { roll: "save", ability })}
              />
            ))}
            {derived.concentrationSave && (
              <ProficiencyRow
                level={saveProficient.has("con") ? "proficient" : "none"}
                name="Concentration"
                modifier={derived.concentrationSave}
                overrideKey="concentrationSave"
                title="Concentration saving throw"
                rules={undefined}
              />
            )}
          </ul>
        </Card>
        <Card
          title="Skills"
          action={
            <AddHomebrewSkill
              character={character}
              buttonRef={addButton}
              onAdded={(name) => setAnnouncement(`Added ${name}.`)}
            />
          }
        >
          <CatalogSkills
            character={character}
            derived={derived}
            onRemoved={(name) => {
              setAnnouncement(`Removed ${name}.`);
              addButton.current?.focus();
            }}
          />
          <p role="status" className="sr-only">
            {announcement}
          </p>
          <PassiveScores character={character} derived={derived} />
        </Card>
      </div>
      <ProficiencyLegend />
    </div>
  );
}

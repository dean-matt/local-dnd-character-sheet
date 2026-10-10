/**
 * The numbers a player reads constantly. Every computed number comes off the derived
 * block; the definition supplies only what a player chose — the scores and which saves
 * and skills they are proficient in — and `Vitals` reads what play has spent from
 * state. A value with terms opens them in a popover; an ability, a save or a skill opens
 * its terms and the catalog's rules text in a modal.
 */
import {
  ABILITIES,
  ABILITY_LABEL,
  type CharacterDerived,
  type CharacterRecord,
  derivedValue,
  effectsOnRoll,
  refKey,
} from "@dnd/character";
import { EmptyState } from "../../../EmptyState.tsx";
import { Card } from "../../Card.tsx";
import { AbilityScores } from "./AbilityScores.tsx";
import { Attacks } from "./Attacks/Attacks.tsx";
import { editionRules, SAVE_RULES } from "./abilityRules.ts";
import { CombatStats } from "./CombatStats.tsx";
import { Defenses } from "./Defenses/Defenses.tsx";
import { Improvements } from "./Improvements.tsx";
import { ItemGrants } from "./ItemGrants.tsx";
import { PassiveScores } from "./PassiveScores/PassiveScores.tsx";
import { ProficiencyLegend } from "./ProficiencyLegend.tsx";
import { ProficiencyRow } from "./ProficiencyRow.tsx";
import { Vitals } from "./Vitals/Vitals.tsx";

export function AbilitiesSection({
  character,
  derived,
}: {
  character: CharacterRecord | undefined;
  derived: CharacterDerived | undefined;
}) {
  if (!character || !derived) return <EmptyState>Abilities isn't available yet.</EmptyState>;
  const { definition } = character;

  const saveProficient = new Set(definition.proficiencies.savingThrows);
  const skillLevel = new Map(
    definition.proficiencies.skills.map((skill) => [refKey(skill.ref), skill.level]),
  );
  const rollEffects = derivedValue(derived.rollEffects);
  const skills = [...derived.skills].sort((a, b) => a.ref.name.localeCompare(b.ref.name));

  return (
    <div className="flex flex-col gap-4">
      <AbilityScores character={character} derived={derived} />
      <Improvements character={character} />
      <CombatStats derived={derived} />
      <Vitals characterId={character.id} derived={derived} />
      <Attacks character={character} derived={derived} />
      <Defenses derived={derived} />
      <ItemGrants derived={derived} />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card title="Saving Throws">
          <ul className="flex flex-col gap-1">
            {ABILITIES.map((ability) => (
              <ProficiencyRow
                key={ability}
                level={saveProficient.has(ability) ? "proficient" : "none"}
                name={ABILITY_LABEL[ability]}
                label={ability.toUpperCase()}
                modifier={derived.savingThrows[ability]}
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
                title="Concentration saving throw"
                rules={undefined}
              />
            )}
          </ul>
        </Card>
        <Card title="Skills">
          <ul className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
            {skills.map((skill) => (
              <ProficiencyRow
                key={refKey(skill.ref)}
                level={skillLevel.get(refKey(skill.ref)) ?? "none"}
                name={skill.ref.name}
                ability={skill.ability}
                modifier={skill.modifier}
                title={skill.ref.name}
                rules={{ tag: "skill", name: skill.ref.name, source: skill.ref.source }}
                effects={effectsOnRoll(rollEffects, {
                  roll: "skill",
                  skill: skill.ref.name,
                  ability: skill.ability,
                })}
              />
            ))}
          </ul>
          <PassiveScores derived={derived} />
        </Card>
      </div>
      <ProficiencyLegend />
    </div>
  );
}
